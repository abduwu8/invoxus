import { X, Sparkles, Mail, Zap, CheckCircle, MessageSquare, Brain, Search } from 'lucide-react'

type NewFeatureModalProps = {
  onClose: () => void
  onTryCold: () => void
}

export function NewFeatureModal({ onClose, onTryCold }: NewFeatureModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-black border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="relative px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 border-b border-neutral-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white flex-shrink-0" />
                <div className="text-base sm:text-lg md:text-xl font-bold text-white truncate">What's New in Invoxus</div>
              </div>
              <div className="text-xs sm:text-sm text-neutral-400 line-clamp-2">Powerful new features to supercharge your email workflow</div>
            </div>
            <button 
              onClick={onClose} 
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            
            {/* Outlook Integration */}
            <div className="group p-3 sm:p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-800 transition-colors">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span>Outlook Integration</span>
                    <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-white text-black rounded-full font-medium">New</span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    Full Microsoft Outlook support with secure OAuth authentication. Manage all your email accounts in one place.
                  </div>
                </div>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="group p-3 sm:p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-800 transition-colors">
                  <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span>Enhanced AI Assistant</span>
                    <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs border border-white/20 text-white rounded-full">Improved</span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    Smarter email analysis, better context understanding, and more accurate responses with zero hallucination.
                  </div>
                </div>
              </div>
            </div>

            {/* Clickable Email Cards */}
            <div className="group p-3 sm:p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-800 transition-colors">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1">
                    Interactive Email Cards
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    Click on any email in AI responses to open it instantly. Beautiful, interactive cards for quick access.
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Filtering */}
            <div className="group p-3 sm:p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-800 transition-colors">
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1">
                    Intelligent Filtering
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    AI now shows only relevant emails based on priority, urgency, and action requirements. No more clutter.
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="group p-3 sm:p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-800 transition-colors">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1">
                    One-Click Actions
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    Quick action buttons for common tasks: Important, Summarize, Attachments, Action Needed - all one click away.
                  </div>
                </div>
              </div>
            </div>

            {/* Improved Compose */}
            <div className="group p-3 sm:p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-800 transition-colors">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white mb-1">
                    Better Email Composition
                  </div>
                  <div className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    Accurate recipient detection, professional templates, and context-aware drafting. Compose emails faster.
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Additional improvements section */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl border border-neutral-800">
            <div className="text-xs font-semibold text-white mb-2">Additional Improvements:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white flex-shrink-0"></div>
                <span>Enhanced business context analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white flex-shrink-0"></div>
                <span>Action items & deadline extraction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white flex-shrink-0"></div>
                <span>Professional email templates</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white flex-shrink-0"></div>
                <span>Aggregate email insights</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white flex-shrink-0"></div>
                <span>Redis caching for speed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-white flex-shrink-0"></div>
                <span>Universal design (personal & work)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 border-t border-neutral-800 flex gap-2 sm:gap-3 flex-shrink-0">
          <button 
            onClick={onClose} 
            className="flex-1 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-neutral-300 border border-neutral-800 rounded-xl hover:bg-neutral-900 hover:text-white transition-all"
          >
            Maybe Later
          </button>
          <button 
            onClick={onTryCold} 
            className="flex-1 px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-black bg-white rounded-xl hover:bg-neutral-200 transition-all"
          >
            Explore Features
          </button>
        </div>
      </div>
    </div>
  )
}

