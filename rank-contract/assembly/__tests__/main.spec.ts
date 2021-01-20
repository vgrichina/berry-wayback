import {
    vote,
    getEloRating,
    // getLeaderboard,
    rankingKey
} from '..';
import { storage, Context } from "near-sdk-as";

describe("Ranking", () => {
    it("can be updated by vote", () => {
        storage.set("elo:a", "140000");
        storage.set("elo:b", "110000");

        const scores = vote([
            { id: "a", score: 0 },
            { id: "b", score: 100 },
        ])
        
        expect(scores[0]).toBe(137283);
        expect(scores[1]).toBe(112716);

        expect(getEloRating("a")).toBe(137283);
        expect(getEloRating("b")).toBe(112716);

        expect(rankingKey('a', 137283)).toBe('862717:a');
        expect(rankingKey('b', 112716)).toBe('887284:b');

        // const leaderboard = getLeaderboard();
        // expect(leaderboard[0].id).toBe('a');
        // expect(leaderboard[1].id).toBe('b');
        // expect(leaderboard[0].elo).toBe(137283);
        // expect(leaderboard[1].elo).toBe(112716);
    });
});
