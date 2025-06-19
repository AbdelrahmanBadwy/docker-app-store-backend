import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || "3000",
  logLevel: process.env.LOG_LEVEL || "info",
  dockerRegistry: {
    url: process.env.DOCKER_REGISTRY_URL || "http://localhost:5000",
  },
};
