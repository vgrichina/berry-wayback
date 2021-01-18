import { Context, logging, storage, AVLTree } from 'near-sdk-as'

const NOMINATION: f64 = 100;
const DEFAULT_ELO = 1500;
const K = 32;

@nearBindgen
class PlayerInfo {
    id: string;
    score: u32; 
}

export function rankingKey(id: string, score: u32): string {
    return u32(10000 * NOMINATION - score).toString() + ":" + id;
}

export function vote(players: PlayerInfo[]): u32[] {
    assert(players.length == 2, 'only 2 player matches are supported');

    let elo1u = getEloRating(players[0].id);
    let elo1 = elo1u / NOMINATION;
    let elo2u = getEloRating(players[1].id);
    let elo2 = elo2u / NOMINATION;
    let e1 = Math.pow(10, elo1 / 400.);
    let e2 = Math.pow(10, elo2 / 400.);

    let scores = [
        u32((elo1 + K * (players[0].score / NOMINATION - e1 / (e1 + e2))) * NOMINATION),
        u32((elo2 + K * (players[1].score / NOMINATION - e2 / (e1 + e2))) * NOMINATION),
    ];

    let leaderboard = new AVLTree<string, string>('leaderboard');
    leaderboard.remove(rankingKey(players[0].id, elo1u));
    leaderboard.remove(rankingKey(players[1].id, elo2u));
    leaderboard.set(rankingKey(players[0].id, scores[0]), players[0].id);
    leaderboard.set(rankingKey(players[1].id, scores[1]), players[1].id);

    setEloRating(players[0].id, scores[0]);
    setEloRating(players[1].id, scores[1]);

    return scores;
}

@nearBindgen
class RankingEntry {
    id: string;
    elo: u32;
}

export function getLeaderboard(): RankingEntry[] {
    let leaderboard = new AVLTree<string, string>('leaderboard');
    // TODO: implement limit
    return leaderboard.values('', '9999999999999999999999999').map<RankingEntry>(playerId => ({
        id: playerId,
        elo: getEloRating(playerId),
    }))
}

export function getEloRating(playerId: string): u32 {
    return storage.getPrimitive<u32>("elo:" + playerId, u32(DEFAULT_ELO * NOMINATION)); 
}

function setEloRating(playerId: string, elo: u32): void {
    storage.set('elo:' + playerId, elo);
}
