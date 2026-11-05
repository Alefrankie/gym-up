import { redirect } from '@sveltejs/kit';

export const load = ({ params }: { params: { id: string } }) => redirect(307, `/community/members/${params.id}`);
