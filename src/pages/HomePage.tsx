import Navbar from '../components/layout/Navbar'
import HeroSection from '../components/home/HeroSection'
import SystemGrid from '../components/home/SystemGrid'
import PricingSection from '../components/home/PricingSection'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-indigo-950 pb-32">
      <Navbar />
      <HeroSection />
      <SystemGrid />
      <PricingSection />
    </main>
  )
}
