import { initializeDatabase } from './db.js';
import { ingestLivePublicFeeds } from './services/newsFetcher.js';

initializeDatabase();
const stats = await ingestLivePublicFeeds();
console.log(JSON.stringify(stats, null, 2));
