import "@/lib/routes";
import { router } from "@/lib/router";
import { nextHandlers } from "@agentcash/router/next";

export const { GET, POST, PUT, PATCH, DELETE } = nextHandlers(router);
