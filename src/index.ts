import "./config/env.js";
import { ensureDatabaseUrl } from "./lib/database-url.js";
import { app } from "./app.js";

ensureDatabaseUrl();

const PORT = parseInt(process.env.API_PORT ?? "4000", 10);

app.listen(PORT, () => {
  console.log(`QuantScope API listening on http://localhost:${PORT}`);
});
