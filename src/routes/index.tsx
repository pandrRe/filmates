import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main class="home">
      <h1 class="wordmark">Filmates</h1>
      <p class="label">No films yet. Add the first.</p>
    </main>
  );
}
