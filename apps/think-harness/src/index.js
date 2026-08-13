import { routeAgentRequest } from "agents";
import { SeedSpecAgent } from "./agent.js";

export { SeedSpecAgent };

export default {
  async fetch(request, env) {
    return (await routeAgentRequest(request, env)) || new Response("Not found", { status: 404 });
  }
};
