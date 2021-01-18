import { vote, getEloRating } from '..';
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
    });
});
