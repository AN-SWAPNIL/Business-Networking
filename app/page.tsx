import { OnboardingFlow } from "@/components/onboarding-flow"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-end gap-2 mb-4">
          <Button asChild variant="outline">
            <Link href="/matches">Your Matches</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/directory">Browse Directory</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile">View Profile</Link>
          </Button>
        </div>
      </div>
      <OnboardingFlow />
    </main>
  )
}
