import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { AudioWaveformIcon, FileTextIcon, Edit3Icon, FilterIcon, FileTypeIcon, ShareIcon } from "lucide-react"
import Link from "next/link"
import Container from "@/components/container"
import TypingEffect from "@/components/typing-effect"
import FloatingElement from "@/components/floating-element"
import type { ReactNode } from "react"

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full">

        <Container size="lg" className="px-4 relative z-10">
          <section className="w-full flex flex-col md:flex-row items-center gap-8 md:gap-16 mb-16">
            <div className="flex-1 space-y-6">

              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                <TypingEffect text="Audio to Text," speed={70} delay={300} />
                <br />
                <span className="text-primary">
                  <TypingEffect text="Filtered" speed={70} delay={1500} />
                </span>
                <TypingEffect text=" Your Way" speed={70} delay={2000} />
              </h1>

              <p className="text-lg text-muted-foreground">
                Upload audio files, get accurate transcriptions, and filter or modify specific words with powerful
                editing tools.
              </p>

              <div className="flex justify-start mt-8">
                <Button
                  size="lg"
                  className="text-lg px-8 py-3 h-auto hover:scale-105 transition-transform duration-300 relative overflow-hidden group"
                  asChild
                >
                  <Link href="/auth/login">
                    Get Started
                    <span className="absolute inset-0 w-full h-full bg-white/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></span>
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex-1 flex justify-center">
              <FloatingElement amplitude={15} duration={5}>
                <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
                  <AudioWaveformIcon className="w-32 h-32 text-primary animate-pulse" />
                  <div className="absolute -inset-8 rounded-full border-4 border-primary/20 animate-ping [animation-duration:3s] [animation-range:0%_70%]"></div>
                </div>
              </FloatingElement>
            </div>

          </section>

          <section className="w-full py-12">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StepCard
                number="1"
                icon={<AudioWaveformIcon className="h-10 w-10 text-primary" />}
                title="Upload Audio"
                description="Upload audio files in various formats including MP3, WAV, and more."
              />
              <StepCard
                number="2"
                icon={<FileTextIcon className="h-10 w-10 text-primary" />}
                title="Get Transcription"
                description="Our advanced AI transcribes your audio into accurate text."
              />
              <StepCard
                number="3"
                icon={<Edit3Icon className="h-10 w-10 text-primary" />}
                title="Filter & Edit"
                description="Filter specific words, replace terms, or modify the transcription."
              />
            </div>
          </section>

          <section className="w-full py-12">
            <h2 className="text-3xl font-bold text-center mb-12">Powerful Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FeatureCard
                icon={<FilterIcon className="h-10 w-10 text-primary" />}
                title="Word Filtering"
                description="Filter out specific words or phrases from your transcriptions with customizable rules."
              />
              <FeatureCard
                icon={<Edit3Icon className="h-10 w-10 text-primary" />}
                title="Text Editing"
                description="Edit transcriptions with an intuitive interface for quick corrections and modifications."
              />
              <FeatureCard
                icon={<FileTypeIcon className="h-10 w-10 text-primary" />}
                title="Format Conversion"
                description="Convert between audio file formats including MP3, WAV, FLAC, and more with a single click."
              />
              <FeatureCard
                icon={<ShareIcon className="h-10 w-10 text-primary" />}
                title="Audio Sharing"
                description="Share your audio files and transcriptions with other users directly on the platform."
              />
            </div>
          </section>

          <section className="w-full py-16 flex flex-col items-center text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Audio?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mb-8">
              Join thousands of users who are saving time and improving their workflow with SoundFilter.
            </p>
            <Button size="lg" className="relative overflow-hidden group" asChild>
              <Link href="/auth/login">
                Get Started Now
                <span className="absolute inset-0 w-full h-full bg-white/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></span>
              </Link>
            </Button>
          </section>

        </Container>
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center text-sm text-muted-foreground relative z-10">
        <span>© {new Date().getFullYear()} SoundFilter</span>
      </footer>

    </div>
  )
}

interface StepCardProps {
  number: string
  icon: ReactNode
  title: string
  description: string
}

function StepCard({ number, icon, title, description }: StepCardProps) {
  return (
    <Card className="p-6 flex flex-col items-center text-center hover:shadow-lg transition-shadow relative overflow-hidden group">
      <div className="absolute -top-6 -left-6 w-16 h-16 bg-primary/10 rounded-full flex items-end justify-end">
        <span className="text-2xl font-bold text-primary mr-2 mb-2">{number}</span>
      </div>
      <div className="mb-4 mt-4 transform group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  )
}

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className="p-6 flex items-start hover:shadow-lg transition-shadow group">
      <div className="mr-4 mt-1 transform group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </Card>
  )
}

