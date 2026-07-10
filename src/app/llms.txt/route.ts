import { skillMd } from "@/lib/skill";

export function GET() {
  return new Response(skillMd(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}
