# Web Vector application refactor

## New structure

- `app/Application/config/services.ts` — the single source of truth for service names and IDs.
- `app/Application/components/Services/Services.tsx` — owns service selection and the main workspace.
- `app/Application/components/Services/Services.module.css` — owns the application sidebar/workspace layout.
- `app/Application/updates/services/whatsapp/Whatsapp.tsx` — the real WhatsApp workspace.
- Other services currently use the same workspace with a placeholder until their components are built.

## New behavior

Clicking a service in the left sidebar selects it. The selected service renders in the large workspace on the right.
There is no popup/modal for services anymore.

To add a real service later:

1. Create its component under `app/Application/updates/services/<service-name>/`.
2. Import it in `app/Application/components/Services/Services.tsx`.
3. Add one `if (serviceId === "...") return <YourComponent />;` branch in `ServiceContent`.

The service list itself only needs to be edited in `config/services.ts`.
