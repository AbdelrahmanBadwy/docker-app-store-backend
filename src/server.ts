import app from "./interfaces/http/app";
import { config } from "./shared/config";
import logger from "./shared/logger";

const port = config.port;

app.listen(port, () => {
  logger.info(`🚀 Server is running on http://localhost:${port}`);
  logger.info(
    `📚 API documentation available at http://localhost:${port}/api-docs`
  );
});
