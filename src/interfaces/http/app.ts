import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import appRoutes from "./routes/appRoutes";
import logger from "../../shared/logger";

const app = express();

// Middleware
app.use(express.json());

// Swagger Documentation Setup
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "App Store Service API",
      version: "1.0.0",
      description: "API for fetching app info from a Docker Registry",
    },
    servers: [{ url: `/` }],
  },
  apis: ["./src/interfaces/http/routes/*.ts"],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// API Routes
app.use("/api", appRoutes);

// Centralized error handling could be added here

app.use((req, res) => {
  logger.warn(`404 - Not Found - ${req.originalUrl}`);
  res.status(404).send("Not Found");
});

export default app;
