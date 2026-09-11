import { services } from "../config/services";

export const Services_Components_names = Object.fromEntries(
  services.map((service) => [service.name, service.id])
);
