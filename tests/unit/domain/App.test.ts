import { AppLocation } from "../../../src/domain/valueObjects/AppLocation";

describe("AppLocation Value Object", () => {
  it("should create a valid app location", () => {
    const location = AppLocation.create("my-app");
    expect(location.value).toBe("my-app");
  });

  it("should throw an error for an empty location", () => {
    expect(() => AppLocation.create("")).toThrow(
      "App location cannot be empty."
    );
  });
});
