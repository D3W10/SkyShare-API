import { redirect } from "@sveltejs/kit";

export function GET() {
    return redirect(303, "https://skyshare.netlify.app/");
}