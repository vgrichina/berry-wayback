import { Context, logging, storage } from 'near-sdk-as'

const NOMINATION: f64 = 100;
const DEFAULT_ELO = 1500;
const K = 32;

@nearBindgen
class PlayerInfo {
    id: string;
    score: u32; 
}

export function vote(players: PlayerInfo[]): u32[] {
    assert(players.length == 2, 'only 2 player matches are supported');

    let elo1 = getEloRating(players[0].id) / NOMINATION;
    let elo2 = getEloRating(players[1].id) / NOMINATION;
    let e1 = Math.pow(10, elo1 / 400.);
    let e2 = Math.pow(10, elo2 / 400.);

    return [
        u32((elo1 + K * (players[0].score / NOMINATION - e1 / (e1 + e2))) * NOMINATION),
        u32((elo2 + K * (players[1].score / NOMINATION - e2 / (e1 + e2))) * NOMINATION),
    ];
}

export function getEloRating(playerId: string): u32 {
    return storage.getPrimitive<u32>("elo:" + playerId, u32(DEFAULT_ELO * NOMINATION)); 
}
