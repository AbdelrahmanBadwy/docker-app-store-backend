import { AppLocation } from "../valueObjects/AppLocation";

// The core business entity for an Application
export interface App {
  name: string;
  location: AppLocation;
  description: string;
  pictureUrl: string;
}
