import { useState } from 'react'

function FeaturePage({ title, subtitle, description, inputs, resultType, onBack, showPromptInput = false, showCountSelect = false }) {
  return (
    <main className="min-h-screen bg-indigo-950 text-white">
      <div className="border-b border-indigo-800 px-6 py-4">
        <button
          onClick={onBack}
          className="rounded-xl border border-indigo-700 bg-indigo-900/40 px-5 py-3 text-sm transition hover:bg-indigo-800"
        >
          ← Back To Home
        </button>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10">
          <div className="text-sm uppercase tracking-[0.2em] text-indigo-300/70">
            AI Workflow System
          </div>

          <h1 className="mt-4 text-5xl font-bold">
            {title}
          </h1>

          <div className="mt-4 text-xl text-indigo-200/80">
            {subtitle}
          </div>

          <p className="mt-8 max-w-4xl text-lg leading-8 text-indigo-100/70">
            {description}
          </p>

          <div className="mt-10 rounded-3xl border border-indigo-700 bg-indigo-900/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-indigo-300/60">
                  Workflow Guide
                </div>

                <div className="mt-2 text-2xl font-bold text-white">
                  操作說明
                </div>
              </div>

              <div className="rounded-full border border-indigo-700 bg-indigo-950/40 px-4 py-2 text-sm text-indigo-200/70">
                Step by Step
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {title.includes('A1') && (
                <>
                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step1</span> 上傳圖片。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step2</span> 本團隊AI資料庫，分析提詞文字。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step3</span> 檢視成果，可運用於AI提詞。
                  </div>
                </>
              )}

              {title.includes('A2') && (
                <>
                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step1</span> 上傳圖片。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step2</span> 本團隊AI資料庫 + 加強圖形辨識模組，分析提詞文字。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step3</span> 檢視成果，可運用於AI提詞。
                  </div>
                </>
              )}

              {title.includes('A3') && (
                <>
                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step1</span> 上傳建築量體圖片、撰寫提詞。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step2</span> 本團隊AI資料庫演算建築視覺成果。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step3</span> 檢視生成成果，建議先只生成單張，感覺大致滿意再選6張。
                  </div>
                </>
              )}

              {title.includes('A4') && (
                <>
                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step1</span> 上傳建築量體圖片 (Sketch)。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step2</span> 上傳風格圖片 (Style)。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step3</span> 檢視生成成果，建議先只生成單張，感覺大致滿意再選6張。
                  </div>
                </>
              )}

              {title.includes('A5') && (
                <>
                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step1</span> 上傳建築量體圖片 (Sketch)。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step2</span> 上傳想風格圖片 (Style)。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step3</span> 上傳基地周邊量體圖片 (Site)，最好視角、圖片尺寸與建築量體圖片 (Sketch) 一致。
                  </div>

                  <div className="rounded-2xl border border-indigo-700 bg-black/20 p-5 text-indigo-100/80">
                    <span className="font-semibold text-white">Step4</span> 檢視生成成果，建議先只生成單張，感覺大致滿意再選6張。
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-3xl border border-indigo-700 bg-indigo-900/40 p-8">
            <h2 className="text-2xl font-bold">
              Upload Inputs
            </h2>

            <div className="mt-8 space-y-6">
              {inputs.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-dashed border-indigo-600 bg-indigo-950/40 p-6"
                >
                  <div className="text-sm text-indigo-200/70">
                    {item}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-dashed border-indigo-600 bg-indigo-950/30 transition hover:border-indigo-400 hover:bg-indigo-900/20">
                    <div className="flex aspect-video items-center justify-center text-indigo-200/40">
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          Drag & Drop Image
                        </div>

                        <div className="mt-2 text-sm text-indigo-200/40">
                          Upload / Preview / Replace
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {showPromptInput && (
                <textarea
                  placeholder="Enter architectural prompt..."
                  className="min-h-[140px] w-full rounded-2xl border border-indigo-700 bg-indigo-950/60 p-4 text-white outline-none"
                />
              )}

              {showCountSelect && (
                <div>
                  <div className="mb-3 text-sm text-indigo-200/70">
                    Output Count
                  </div>

                  <select className="w-full rounded-2xl border border-indigo-700 bg-indigo-950/60 p-4 text-white outline-none">
                    <option>1 Image</option>
                    <option>6 Images</option>
                  </select>
                </div>
              )}

              <button className="w-full rounded-2xl bg-white py-4 text-lg font-semibold text-black transition hover:scale-[1.01]">
                Generate AI Result
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-700 bg-indigo-900/40 p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                Result Preview
              </h2>

              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                Ready
              </div>
            </div>

            {resultType === 'prompt' ? (
              <div className="mt-8 rounded-3xl border border-indigo-700 bg-black/20 p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-lg font-semibold text-indigo-100/90">
                    Prompt Result
                  </div>

                  <button className="rounded-xl border border-indigo-700 bg-indigo-900/40 px-4 py-2 text-sm transition hover:bg-indigo-800">
                    Copy Prompt
                  </button>
                </div>

                <div className="rounded-2xl border border-indigo-700 bg-indigo-950/40 p-6 font-mono leading-8 text-indigo-100/80">
                  modern architectural facade, luxury residential building, clean geometry, glass curtain wall, cinematic lighting, urban atmosphere, realistic architectural visualization
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-lg font-semibold text-indigo-100/90">
                    AI Render Result
                  </div>

                  <div className="flex gap-3">
                    <button className="rounded-xl border border-indigo-700 bg-indigo-900/40 px-4 py-2 text-sm transition hover:bg-indigo-800">
                      ◀
                    </button>

                    <button className="rounded-xl border border-indigo-700 bg-indigo-900/40 px-4 py-2 text-sm transition hover:bg-indigo-800">
                      ▶
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-indigo-700 bg-black/20">
                  <div className="flex aspect-[16/10] items-center justify-center bg-indigo-950/30 text-indigo-200/30 text-xl">
                    Main Render Preview
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-6 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <button
                      key={item}
                      className="overflow-hidden rounded-2xl border border-indigo-700 bg-indigo-950/30 transition hover:scale-[1.02] hover:border-indigo-400"
                    >
                      <div className="flex aspect-square items-center justify-center text-xs text-indigo-200/30">
                        Preview {item}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-28 rounded-[40px] border border-indigo-700 bg-indigo-900/30 p-12">
          <div className="text-center">
            <div className="text-sm uppercase tracking-[0.3em] text-indigo-300/50">
              Membership Access
            </div>

            <h2 className="mt-5 text-5xl font-black">
              Choose Your AI Access
            </h2>
          </div>

          <div className="mt-14 grid gap-8 xl:grid-cols-3">
            <div className="rounded-3xl border border-indigo-700 bg-black/20 p-10">
              <div className="text-3xl font-bold">Starter</div>
              <div className="mt-3 text-indigo-200/70">A1 ~ A5</div>
              <div className="mt-10 text-5xl font-black">Free</div>
              <button className="mt-10 w-full rounded-2xl bg-white py-4 font-semibold text-black">
                Start Free
              </button>
            </div>

            <div className="rounded-3xl border border-indigo-500 bg-indigo-800/30 p-10 shadow-2xl shadow-indigo-950/50">
              <div className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                Recommended
              </div>

              <div className="mt-6 text-3xl font-bold">Professional</div>
              <div className="mt-3 text-indigo-200/70">A1 ~ A7</div>
              <div className="mt-10 text-5xl font-black">Plus</div>
              <button className="mt-10 w-full rounded-2xl bg-white py-4 font-semibold text-black">
                Upgrade Plan
              </button>
            </div>

            <div className="rounded-3xl border border-indigo-700 bg-black/20 p-10">
              <div className="text-3xl font-bold">Studio</div>
              <div className="mt-3 text-indigo-200/70">Full Access</div>
              <div className="mt-10 text-5xl font-black">Pro</div>
              <button className="mt-10 w-full rounded-2xl bg-white py-4 font-semibold text-black">
                Contact Team
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-24 flex flex-col items-center justify-between gap-8 border-t border-indigo-800 py-10 text-indigo-200/60 lg:flex-row">
          <div>
            AI Architect System © 2026
          </div>

          <div className="flex gap-6 text-sm">
            <button className="transition hover:text-white">Login</button>
            <button className="transition hover:text-white">Register</button>
            <button className="transition hover:text-white">Contact</button>
            <button className="transition hover:text-white">Email Feedback</button>
          </div>
        </footer>
      </div>
    </main>
  )
}

export default function HomePage() {
  const [page, setPage] = useState('home')
  const [theme, setTheme] = useState('blue')

  const themes = {
    dark: {
      bg: 'bg-black',
      card: 'bg-zinc-900/70',
      border: 'border-zinc-700',
      text: 'text-white',
      sub: 'text-zinc-400',
    },

    charcoal: {
      bg: 'bg-zinc-800',
      card: 'bg-zinc-700/70',
      border: 'border-zinc-500',
      text: 'text-white',
      sub: 'text-zinc-300',
    },

    gray: {
      bg: 'bg-zinc-300',
      card: 'bg-zinc-100',
      border: 'border-zinc-400',
      text: 'text-black',
      sub: 'text-zinc-700',
    },

    white: {
      bg: 'bg-white',
      card: 'bg-zinc-50',
      border: 'border-zinc-300',
      text: 'text-black',
      sub: 'text-zinc-600',
    },

    blue: {
      bg: 'bg-indigo-950',
      card: 'bg-indigo-900/40',
      border: 'border-indigo-700',
      text: 'text-white',
      sub: 'text-indigo-200/70',
    },
  }

  const currentTheme = themes[theme]

  const workflows = [
    {
      id: 'A1',
      title: 'Prompt Basic',
      subtitle: '提詞功能 V1',
      description: '圖形判斷生文',
      resultType: 'prompt',
      inputs: ['Building Image Upload'],
      showPromptInput: false,
      showCountSelect: false,
    },
    {
      id: 'A2',
      title: 'Prompt Precision',
      subtitle: '提詞功能 V2',
      description: '加重圖形判斷',
      resultType: 'prompt',
      inputs: ['Building Image Upload'],
      showPromptInput: false,
      showCountSelect: false,
    },
    {
      id: 'A3',
      title: 'Sketch Prompt',
      subtitle: '自行提詞 + Sketch',
      description: '草圖生成建築渲染',
      resultType: 'image',
      inputs: ['Sketch Upload'],
      showPromptInput: true,
      showCountSelect: true,
    },
    {
      id: 'A4',
      title: 'Style Sketch',
      subtitle: '風格圖 + Sketch',
      description: '風格融合建築渲染',
      resultType: 'image',
      inputs: ['Sketch Upload', 'Style Image Upload'],
      showPromptInput: false,
      showCountSelect: true,
    },
    {
      id: 'A5',
      title: 'Style Sketch Site',
      subtitle: '風格圖 + Sketch + Site',
      description: '基地環境整合建築渲染',
      resultType: 'image',
      inputs: ['Sketch Upload', 'Style Image Upload', 'Site Image Upload'],
      showPromptInput: false,
      showCountSelect: true,
    },
    {
      id: 'A6',
      title: 'Style Sketch 2K',
      subtitle: '風格圖 + Sketch + 2K',
      description: '高解析建築渲染輸出',
      resultType: 'image',
      inputs: ['Sketch Upload', 'Style Image Upload'],
      showPromptInput: false,
      showCountSelect: true,
    },
    {
      id: 'A7',
      title: 'Style Sketch Site 2K',
      subtitle: '風格圖 + Sketch + Site + 2K',
      description: '基地整合高解析建築渲染',
      resultType: 'image',
      inputs: ['Sketch Upload', 'Style Image Upload', 'Site Image Upload'],
      showPromptInput: false,
      showCountSelect: true,
    },
    {
      id: 'A8',
      title: 'Full Control Mode',
      subtitle: '全控制建築工作流',
      description: '多模型整合控制',
      resultType: 'image',
      inputs: ['Sketch Upload', 'Style Upload', 'Site Upload', 'Depth Upload'],
      showPromptInput: true,
      showCountSelect: true,
    },
    {
      id: 'A9',
      title: 'Motion Render',
      subtitle: 'AI 建築動畫輸出',
      description: '建築動畫與鏡頭模擬',
      resultType: 'image',
      inputs: ['Render Upload'],
      showPromptInput: true,
      showCountSelect: true,
    },
  ]

  const currentPage = workflows.find((w) => w.id === page)

  if (currentPage) {
    return (
      <FeaturePage
        title={`${currentPage.id} ${currentPage.title}`}
        subtitle={currentPage.subtitle}
        description={currentPage.description}
        inputs={currentPage.inputs}
        resultType={currentPage.resultType}
        showPromptInput={currentPage.showPromptInput}
        showCountSelect={currentPage.showCountSelect}
        onBack={() => setPage('home')}
      />
    )
  }

  return (
    <main className={`min-h-screen px-10 py-20 transition-all duration-500 ${currentTheme.bg} ${currentTheme.text}`}>
      <div className="fixed right-6 top-24 z-50 flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 backdrop-blur-xl">
        <button onClick={() => setTheme('dark')} className="h-8 w-8 rounded-full border border-white/20 bg-black" />
        <button onClick={() => setTheme('charcoal')} className="h-8 w-8 rounded-full border border-white/20 bg-zinc-700" />
        <button onClick={() => setTheme('gray')} className="h-8 w-8 rounded-full border border-zinc-400 bg-zinc-300" />
        <button onClick={() => setTheme('white')} className="h-8 w-8 rounded-full border border-zinc-400 bg-white" />
        <button onClick={() => setTheme('blue')} className="h-8 w-8 rounded-full border border-indigo-300 bg-indigo-700" />
      </div>

      <div className={`flex items-center justify-between border-b pb-6 ${currentTheme.border}`}>
          <div className="text-xl font-bold tracking-wide">
            ARCHITECT AI SYSTEM
          </div>

          <div className="flex items-center gap-6 text-sm">
            <button className="transition hover:opacity-70">AI Systems</button>
            <button className="transition hover:opacity-70">Pricing</button>
            <button className="transition hover:opacity-70">Contact</button>
            <button className="rounded-xl bg-white px-4 py-2 text-black">Login</button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl">
        <div className="max-w-5xl">
          <div className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm text-emerald-300">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            AI Architectural Visualization Platform
          </div>

          <h1 className="mt-10 text-7xl font-black tracking-tight">
            ARCHITECT AI SYSTEM
          </h1>

          <div className={`mt-10 space-y-4 text-xl leading-9 ${currentTheme.sub}`}>
            <div>本團隊由一群熱衷於建築的開業建築師所組成，並開發此 AI 建築視覺化系統。</div>
            <div>系統依據多年實務經驗需求進行校正，可迅速提供多方案的建築渲染、透視與動畫模擬。</div>
            <div>我們專注於可控制的建築量體環境下，依據透視風格、立面語彙與空間比例，透過 AI 系統加速建築設計視覺化流程。</div>
          </div>
        </div>

        <div className="mt-20 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          
          {workflows.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`rounded-3xl border p-10 text-left transition hover:scale-[1.02] ${
                ['A6','A7','A8','A9'].includes(item.id)
                  ? 'opacity-50 border-zinc-700 bg-zinc-900/40'
                  : `${currentTheme.border} ${currentTheme.card}`
              }`}
            >
              <div className={`text-5xl font-black ${currentTheme.sub}`}>
                {item.id}
              </div>

              <div className="mt-8 text-3xl font-bold">
                {item.title}
              </div>

              <div className={`mt-3 text-lg ${currentTheme.sub}`}>
                {item.subtitle}
              </div>

              <div className="mt-10 flex items-center justify-between">
                <div className={`inline-flex rounded-full px-4 py-2 text-xs ${
                  ['A6','A7','A8','A9'].includes(item.id)
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                }`}>
                  {['A6','A7','A8','A9'].includes(item.id)
                    ? 'Under Construction'
                    : 'Live System'}
                </div>

                <div className="inline-flex rounded-2xl bg-white px-5 py-3 text-black">
                  {['A6','A7','A8','A9'].includes(item.id)
                    ? 'Coming Soon'
                    : 'Open System'}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-28 rounded-[40px] border border-white/10 bg-black/10 p-12 backdrop-blur-xl">
          <div className="text-center">
            <div className={`text-sm uppercase tracking-[0.3em] ${currentTheme.sub}`}>
              Membership Access
            </div>

            <h2 className="mt-5 text-5xl font-black">
              Choose Your AI Access
            </h2>
          </div>

          <div className="mt-14 grid gap-8 xl:grid-cols-3">
            <div className={`rounded-3xl border p-10 ${currentTheme.border} ${currentTheme.card}`}>
              <div className="text-3xl font-bold">Starter</div>
              <div className={`mt-3 ${currentTheme.sub}`}>A1 ~ A5</div>
              <div className="mt-10 text-5xl font-black">Free</div>
              <button className="mt-10 w-full rounded-2xl bg-white py-4 font-semibold text-black">
                Start Free
              </button>
            </div>

            <div className={`scale-[1.03] rounded-3xl border-2 p-10 shadow-2xl shadow-black/30 ${currentTheme.border} ${currentTheme.card}`}>
              <div className="text-3xl font-bold">Professional</div>
              <div className={`mt-3 ${currentTheme.sub}`}>A1 ~ A7</div>
              <div className="mt-10 text-5xl font-black">Plus</div>
              <button className="mt-10 w-full rounded-2xl bg-white py-4 font-semibold text-black">
                Upgrade Plan
              </button>
            </div>

            <div className={`rounded-3xl border p-10 ${currentTheme.border} ${currentTheme.card}`}>
              <div className="text-3xl font-bold">Studio</div>
              <div className={`mt-3 ${currentTheme.sub}`}>Full Access</div>
              <div className="mt-10 text-5xl font-black">Pro</div>
              <button className="mt-10 w-full rounded-2xl bg-white py-4 font-semibold text-black">
                Contact Team
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
