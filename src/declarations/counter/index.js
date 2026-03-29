import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "./counter.did.js";

export { idlFactory } from "./counter.did.js";

export const canisterId =
  import.meta.env.VITE_COUNTER_CANISTER_ID ??
  (typeof process !== "undefined" ? process.env.COUNTER_CANISTER_ID : undefined);

export const createActor = (canisterId, options = {}) => {
  const agent = options.agent || new HttpAgent({ ...options.agentOptions });

  if (options.agent && options.agentOptions) {
    console.warn(
      "Detected both agent and agentOptions passed to createActor. Ignoring agentOptions and proceeding with the provided agent."
    );
  }

  if (import.meta.env.DEV) {
    agent.fetchRootKey().catch((err) => {
      console.warn(
        "Unable to fetch root key. Check to ensure that your local replica is running"
      );
      console.error(err);
    });
  }

  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
    ...options.actorOptions,
  });
};

export const counter = canisterId ? createActor(canisterId) : undefined;
