import { Router } from "express";
import { getAllAppsController } from "../controllers/appController";

const router = Router();

/**
 * @openapi
 * /api/apps:
 * get:
 * summary: Retrieve a list of all applications
 * description: Fetches all apps from the configured Docker registry.
 * tags: [Apps]
 * responses:
 * 200:
 * description: A list of applications.
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * type: object
 * properties:
 * name:
 * type: string
 * example: My Awesome App
 * location:
 * type: string
 * example: my-awesome-app
 * description:
 * type: string
 * example: This is a fantastic application.
 * pictureUrl:
 * type: string
 * example: https://example.com/app.png
 */
router.get("/apps", getAllAppsController);

export default router;
