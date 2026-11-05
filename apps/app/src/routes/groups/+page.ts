import { redirect } from '@sveltejs/kit';

// Groups were replaced by Community (DR-0028); old links and bookmarks land on the feed.
export const load = () => redirect(307, '/community');
