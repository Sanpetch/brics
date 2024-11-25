// app/page.tsx
import Header from '@/components/BRICSInterface/Header'
import VaultStatus from '@/components/BRICSInterface/VaultStatus'
import CBDCPools from '@/components/BRICSInterface/CBDCPools'
import ExchangeModule from '@/components/BRICSInterface/ExchangeModule'
import Analytics from '@/components/BRICSInterface/Analytics'
import RiskManagement from '@/components/BRICSInterface/RiskManagement'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <VaultStatus />
        <CBDCPools />
        <ExchangeModule />
        <Analytics />
        <RiskManagement />
      </div>
    </div>
  )
}