import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-8">
      <div className="w-full max-w-3xl">
        <Dashboard />
      </div>
    </div>
  );
}
