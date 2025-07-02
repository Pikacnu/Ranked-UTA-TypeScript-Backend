import type { Game } from "./game";

export enum ServerStatus{
  Pending = 'pending',
  InGame = 'in-game',
}

export class Server{
  id: string;
  status: ServerStatus;
  players: string[];
  game?:Game;

  constructor(id: string, players: string[]){
    this.id = id;
    this.status = ServerStatus.Pending;
    this.players = players;
  }
  
}