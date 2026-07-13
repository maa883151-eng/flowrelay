import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-[#111318] px-4 py-8">
      <div className="w-full max-w-3xl">
        <Dashboard />
      </div>
    </div>
  );
}
