import type { Principal } from '@dfinity/principal';
import type { ActorSubclass } from '@dfinity/agent';
import type { _SERVICE } from './counter.did';

export { idlFactory } from './counter.did';
export const canisterId: string | undefined;
export const createActor: (
  canisterId: string | Principal,
  options?: { agentOptions?: import("@dfinity/agent").HttpAgentOptions; actorOptions?: import("@dfinity/agent").ActorConfig; agent?: import("@dfinity/agent").Agent }
) => ActorSubclass<_SERVICE>;
export const counter: ActorSubclass<_SERVICE> | undefined;
