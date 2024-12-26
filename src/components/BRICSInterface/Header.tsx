// components/BRICSInterface/Header.tsx
import { Globe, BellRing, Shield } from 'lucide-react';

export default function Header() {

  
  return (
    <nav className="bg-white shadow-sm rounded-lg p-4 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">BRICS xxxxxxxxx </h1>
        </div>
        <div className="flex gap-4 items-center">
          <BellRing className="w-6 h-6 text-gray-600" />
          <Shield className="w-6 h-6 text-gray-600" />
        </div>
      </div>
    </nav>
  );
}