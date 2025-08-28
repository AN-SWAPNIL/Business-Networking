import { Sidebar } from "@/components/ui/sidebar";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Admin Panel</h2>
        </div>
        <nav className="mt-4">
          <Link
            href="/admin/csv-import"
            className="block px-4 py-2 text-sm hover:bg-gray-100"
          >
            CSV Import
          </Link>
          <Link
            href="/admin/users"
            className="block px-4 py-2 text-sm hover:bg-gray-100"
          >
            User Management
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
