import {
  Globe,
  MousePointerClick,
  Keyboard,
  Timer,
  GitBranch,
  Star,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle,
  Package,
  MessageCircle,
  ThumbsUp,
  Repeat2,
  Mail,
  Paperclip,
  Newspaper,
  Users,
  Building2,
  Search,
  FileText,
  DollarSign,
  BarChart3,
} from 'lucide-react';

interface Props {
  data: Record<string, any>;
  action: string;
}

// ── Products / Price Data ─────────────────────────────────────────────
function ProductsRenderer({ products, total, currency }: { products: Array<Record<string, any>>; total?: number; currency?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Package className="w-3.5 h-3.5 inline mr-1" />
          {total ? `${total} products found` : `${products.length} products`}
        </span>
        {currency && <span className="text-xs text-gray-400">{currency}</span>}
      </div>
      <div className="space-y-2">
        {products.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600 font-bold text-sm">
              #{i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{String(p.name)}</p>
              <div className="flex items-center gap-3 mt-0.5">
                {p.rating && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-600">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {String(p.rating)}
                    {p.reviews && <span className="text-gray-400 ml-0.5">({Number(p.reviews).toLocaleString()})</span>}
                  </span>
                )}
                {p.availability && (
                  <span className={`text-xs ${String(p.availability) === 'In Stock' ? 'text-green-600' : 'text-amber-600'}`}>
                    {String(p.availability)}
                  </span>
                )}
                {p.prime && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">PRIME</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">{String(p.price)}</p>
              {p.original_price && Number(String(p.original_price).replace('$', '')) > Number(String(p.price).replace('$', '')) && (
                <p className="text-xs text-gray-400 line-through">{String(p.original_price)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── News / Articles ───────────────────────────────────────────────────
function NewsRenderer({ articles, total, relevance }: { articles: Array<Record<string, any>>; total?: number; relevance?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Newspaper className="w-3.5 h-3.5 inline mr-1" />
          {total ? `${total} articles found` : `${articles.length} headlines`}
        </span>
        {relevance && <span className="text-xs text-green-600">Relevance: {relevance}</span>}
      </div>
      <div className="space-y-2">
        {articles.map((a, i) => (
          <div key={i} className="p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
            <p className="text-sm font-medium text-gray-800 leading-snug">{String(a.title)}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-semibold text-primary-600">{String(a.source)}</span>
              {a.author && <span className="text-xs text-gray-400">by {String(a.author)}</span>}
              {a.published && (
                <span className="text-xs text-gray-400 ml-auto">{String(a.published)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Social / Tweets ───────────────────────────────────────────────────
function SocialRenderer({ data }: { data: Record<string, any> }) {
  const sentiment = data.sentiment as Record<string, number> | undefined;
  const posts = data.top_posts as Array<Record<string, any>> | undefined;
  const total = data.total_mentions as number;
  const engagement = data.engagement_rate as string;

  return (
    <div>
      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="p-2.5 rounded-lg bg-blue-50 text-center">
          <p className="text-lg font-bold text-blue-700">{total?.toLocaleString()}</p>
          <p className="text-[10px] text-blue-500 uppercase font-semibold">Mentions</p>
        </div>
        <div className="p-2.5 rounded-lg bg-green-50 text-center">
          <p className="text-lg font-bold text-green-700">{engagement}</p>
          <p className="text-[10px] text-green-500 uppercase font-semibold">Engagement</p>
        </div>
        <div className="p-2.5 rounded-lg bg-purple-50 text-center">
          <p className="text-lg font-bold text-purple-700">{data.trending ? 'Yes' : 'No'}</p>
          <p className="text-[10px] text-purple-500 uppercase font-semibold">Trending</p>
        </div>
      </div>

      {/* Sentiment bar */}
      {sentiment && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Sentiment</span>
            <span>
              <span className="text-green-600">{sentiment.positive}%</span>
              {' / '}
              <span className="text-gray-500">{sentiment.neutral}%</span>
              {' / '}
              <span className="text-red-500">{sentiment.negative}%</span>
            </span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-green-400" style={{ width: `${sentiment.positive}%` }} />
            <div className="bg-gray-300" style={{ width: `${sentiment.neutral}%` }} />
            <div className="bg-red-400" style={{ width: `${sentiment.negative}%` }} />
          </div>
        </div>
      )}

      {/* Posts */}
      {posts && posts.length > 0 && (
        <div className="space-y-2">
          {posts.map((p, i) => (
            <div key={i} className="p-2.5 rounded-lg bg-white border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-blue-500">{String(p.user)}</span>
              </div>
              <p className="text-sm text-gray-700 mb-1.5">{String(p.text)}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{Number(p.likes).toLocaleString()}</span>
                <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" />{Number(p.retweets).toLocaleString()}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{Number(p.replies).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reddit Posts ──────────────────────────────────────────────────────
function RedditRenderer({ posts, total, timeRange }: { posts: Array<Record<string, any>>; total?: number; timeRange?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <MessageCircle className="w-3.5 h-3.5 inline mr-1" />
          {total ? `${total} discussions` : `${posts.length} posts`}
        </span>
        {timeRange && <span className="text-xs text-gray-400">{timeRange}</span>}
      </div>
      <div className="space-y-2">
        {posts.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex flex-col items-center justify-center flex-shrink-0">
              <TrendingUp className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] font-bold text-orange-600">{Number(p.score).toLocaleString()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{String(p.title)}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-blue-500">{String(p.subreddit)}</span>
                <span className="text-xs text-gray-400">{Number(p.comments)} comments</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Invoices ──────────────────────────────────────────────────────────
function InvoiceRenderer({ invoices, totalAmount }: { invoices: Array<Record<string, any>>; totalAmount?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <FileText className="w-3.5 h-3.5 inline mr-1" />
          {invoices.length} invoices
        </span>
        {totalAmount && (
          <span className="text-sm font-bold text-gray-800">
            <DollarSign className="w-3.5 h-3.5 inline" />
            Total: {totalAmount}
          </span>
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Invoice #</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Vendor</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Category</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Amount</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((inv, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-600">{String(inv.invoice_no)}</td>
                <td className="px-3 py-2 font-medium">{String(inv.vendor)}</td>
                <td className="px-3 py-2 text-gray-500">{String(inv.category)}</td>
                <td className="px-3 py-2 text-right font-semibold">{String(inv.amount)}</td>
                <td className="px-3 py-2 text-right text-gray-500">{String(inv.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Emails ────────────────────────────────────────────────────────────
function EmailRenderer({ emails, unread, total }: { emails: Array<Record<string, any>>; unread?: number; total?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Mail className="w-3.5 h-3.5 inline mr-1" />
          {total ? `${total} matching emails` : `${emails.length} emails`}
        </span>
        {unread !== undefined && unread > 0 && (
          <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{unread} unread</span>
        )}
      </div>
      <div className="space-y-2">
        {emails.map((e, i) => (
          <div key={i} className="p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-gray-800 truncate flex-1">{String(e.subject)}</p>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{String(e.date)}</span>
            </div>
            <p className="text-xs text-primary-600 mb-1">{String(e.from)}</p>
            <p className="text-xs text-gray-500 line-clamp-1">{String(e.preview)}</p>
            {e.attachments && Array.isArray(e.attachments) && (e.attachments as string[]).length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Paperclip className="w-3 h-3 text-gray-400" />
                {(e.attachments as string[]).map((a, j) => (
                  <span key={j} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{a}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Leads / Profiles ─────────────────────────────────────────────────
function LeadsRenderer({ profiles, quality }: { profiles: Array<Record<string, any>>; quality?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Users className="w-3.5 h-3.5 inline mr-1" />
          {profiles.length} profiles found
        </span>
        {quality && <span className="text-xs text-green-600">Match: {quality}</span>}
      </div>
      <div className="space-y-2">
        {profiles.map((p, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
              {String(p.name).split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{String(p.name)}</p>
              <p className="text-xs text-gray-500">{String(p.title)} at <span className="font-medium text-gray-700">{String(p.company)}</span></p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span>{String(p.location)}</span>
                <span>{Number(p.connections).toLocaleString()} connections</span>
              </div>
            </div>
            {p.recent_activity && (
              <p className="text-[10px] text-gray-400 max-w-[140px] text-right flex-shrink-0">{String(p.recent_activity)}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Search Results ───────────────────────────────────────────────────
function SearchRenderer({ results, total, time }: { results: Array<Record<string, any>>; total?: string; time?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <Search className="w-3.5 h-3.5 inline mr-1" />
          {total ? `${total} results` : `${results.length} results`}
        </span>
        {time && <span className="text-xs text-gray-400">{time}</span>}
      </div>
      <div className="space-y-2.5">
        {results.map((r, i) => (
          <div key={i} className="group">
            <p className="text-sm font-medium text-blue-700 group-hover:underline cursor-pointer">{String(r.title)}</p>
            <p className="text-xs text-green-700 truncate">{String(r.url)}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{String(r.snippet)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Company Info ─────────────────────────────────────────────────────
function CompanyRenderer({ data }: { data: Record<string, any> }) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg bg-white border border-gray-100">
      <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-6 h-6 text-primary-600" />
      </div>
      <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2">
        <div>
          <p className="text-xs text-gray-400">Company</p>
          <p className="text-sm font-semibold text-gray-800">{String(data.company)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Industry</p>
          <p className="text-sm text-gray-700">{String(data.industry)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Employees</p>
          <p className="text-sm text-gray-700">{String(data.employees)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Funding</p>
          <p className="text-sm font-semibold text-green-700">{String(data.funding)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Founded</p>
          <p className="text-sm text-gray-700">{String(data.founded)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Headquarters</p>
          <p className="text-sm text-gray-700">{String(data.headquarters)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Metrics / Dashboard ──────────────────────────────────────────────
function MetricsRenderer({ metrics, period }: { metrics: Record<string, any>; period?: string }) {
  const metricConfig: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
    monthly_revenue: { label: 'Revenue', color: 'bg-green-50 text-green-700', icon: DollarSign },
    active_users: { label: 'Active Users', color: 'bg-blue-50 text-blue-700', icon: Users },
    conversion_rate: { label: 'Conversion', color: 'bg-purple-50 text-purple-700', icon: TrendingUp },
    churn_rate: { label: 'Churn', color: 'bg-red-50 text-red-700', icon: TrendingDown },
    nps_score: { label: 'NPS Score', color: 'bg-amber-50 text-amber-700', icon: BarChart3 },
  };

  return (
    <div>
      {period && <p className="text-xs text-gray-400 mb-3">{period}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(metrics).map(([key, value]) => {
          const config = metricConfig[key] || { label: key.replace(/_/g, ' '), color: 'bg-gray-50 text-gray-700', icon: BarChart3 };
          const Icon = config.icon;
          return (
            <div key={key} className={`p-3 rounded-lg ${config.color}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase">{config.label}</span>
              </div>
              <p className="text-lg font-bold">{String(value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Navigate result ──────────────────────────────────────────────────
function NavigateRenderer({ data }: { data: Record<string, any> }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
      <Globe className="w-8 h-8 text-blue-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{String(data.page_title)}</p>
        <p className="text-xs text-blue-600 truncate">{String(data.url)}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            {String(data.status_code)}
          </span>
          <span>{data.load_time_ms}ms</span>
          {data.scripts_loaded && <span>{String(data.scripts_loaded)} scripts</span>}
        </div>
      </div>
    </div>
  );
}

// ── Click result ─────────────────────────────────────────────────────
function ClickRenderer({ data }: { data: Record<string, any> }) {
  const coords = data.coordinates as Record<string, number> | undefined;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
      <MousePointerClick className="w-8 h-8 text-amber-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">Clicked: <span className="font-semibold">{String(data.element)}</span></p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>&lt;{String(data.tag)}&gt;</span>
          {coords && <span>({coords.x}, {coords.y})</span>}
          <span>{data.response_time_ms}ms</span>
          {data.triggered_navigation && (
            <span className="flex items-center gap-0.5 text-blue-500"><ArrowRight className="w-3 h-3" />Navigated</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Type result ──────────────────────────────────────────────────────
function TypeRenderer({ data }: { data: Record<string, any> }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
      <Keyboard className="w-8 h-8 text-green-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-gray-600">Typed into <span className="font-semibold text-gray-800">{String(data.element)}</span></p>
        <p className="text-sm font-mono bg-white rounded px-2 py-1 mt-1 border border-green-100 text-gray-800">{String(data.text_entered)}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span>{data.characters} chars</span>
          {data.field_valid && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" />Valid</span>}
          {data.autocomplete_triggered && <span className="text-blue-500">Autocomplete</span>}
        </div>
      </div>
    </div>
  );
}

// ── Wait result ──────────────────────────────────────────────────────
function WaitRenderer({ data }: { data: Record<string, any> }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
      <Timer className="w-8 h-8 text-gray-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-gray-700">Waited <span className="font-bold">{Number(data.waited_ms).toLocaleString()}ms</span></p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          {data.page_ready && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" />Page ready</span>}
          {data.dynamic_content_loaded && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" />Content loaded</span>}
          {data.network_idle && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" />Network idle</span>}
        </div>
      </div>
    </div>
  );
}

// ── Conditional result ───────────────────────────────────────────────
function ConditionalRenderer({ data }: { data: Record<string, any> }) {
  const result = data.evaluated_to as boolean;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${result ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
      <GitBranch className={`w-8 h-8 flex-shrink-0 ${result ? 'text-green-500' : 'text-red-500'}`} />
      <div className="flex-1">
        <p className="text-sm text-gray-700">
          Condition: <code className="text-xs bg-white rounded px-1.5 py-0.5 border font-mono">{String(data.expression)}</code>
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`text-sm font-bold ${result ? 'text-green-700' : 'text-red-700'}`}>
            {result ? 'TRUE' : 'FALSE'}
          </span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-500">{String(data.branch_taken)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation result ──────────────────────────────────────────────
function ConfirmationRenderer({ data }: { data: Record<string, any> }) {
  return (
    <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
      <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
      <p className="text-sm font-semibold text-green-800">{String(data.status)}</p>
      <p className="text-xs text-gray-600 mt-1">{String(data.message)}</p>
      <p className="text-xs font-mono text-green-700 mt-2 bg-green-100 inline-block px-3 py-1 rounded-full">
        {String(data.confirmation_id)}
      </p>
    </div>
  );
}

// ── Main dispatcher ──────────────────────────────────────────────────
export default function ResultRenderer({ data, action }: Props) {
  // Action-based simple renderers
  if (action === 'navigate' && data.url && data.page_title) return <NavigateRenderer data={data} />;
  if (action === 'click' && data.element && data.clicked) return <ClickRenderer data={data} />;
  if (action === 'type' && data.text_entered !== undefined) return <TypeRenderer data={data} />;
  if (action === 'wait' && data.waited_ms) return <WaitRenderer data={data} />;
  if (action === 'conditional' && data.expression) return <ConditionalRenderer data={data} />;

  // Data-shape based smart renderers
  if (data.products && Array.isArray(data.products)) {
    return <ProductsRenderer products={data.products as Array<Record<string, any>>} total={data.total_found as number} currency={data.currency as string} />;
  }
  if (data.articles && Array.isArray(data.articles)) {
    return <NewsRenderer articles={data.articles as Array<Record<string, any>>} total={data.total_results as number} relevance={data.topic_relevance as string} />;
  }
  if (data.top_posts || data.sentiment) {
    return <SocialRenderer data={data} />;
  }
  if (data.posts && Array.isArray(data.posts) && (data.posts as Array<Record<string, any>>)[0]?.subreddit) {
    return <RedditRenderer posts={data.posts as Array<Record<string, any>>} total={data.total_results as number} timeRange={data.time_range as string} />;
  }
  if (data.invoices && Array.isArray(data.invoices)) {
    return <InvoiceRenderer invoices={data.invoices as Array<Record<string, any>>} totalAmount={data.total_amount as string} />;
  }
  if (data.emails && Array.isArray(data.emails)) {
    return <EmailRenderer emails={data.emails as Array<Record<string, any>>} unread={data.unread as number} total={data.total_matching as number} />;
  }
  if (data.profiles && Array.isArray(data.profiles)) {
    return <LeadsRenderer profiles={data.profiles as Array<Record<string, any>>} quality={data.match_quality as string} />;
  }
  if (data.results && Array.isArray(data.results) && (data.results as Array<Record<string, any>>)[0]?.snippet) {
    return <SearchRenderer results={data.results as Array<Record<string, any>>} total={data.total_results as string} time={data.search_time as string} />;
  }
  if (data.company && data.industry) {
    return <CompanyRenderer data={data} />;
  }
  if (data.metrics && typeof data.metrics === 'object') {
    return <MetricsRenderer metrics={data.metrics as Record<string, any>} period={data.period as string} />;
  }
  if (data.confirmation_id) {
    return <ConfirmationRenderer data={data} />;
  }

  // Fallback: formatted key-value pairs
  return (
    <div className="space-y-1.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-sm">
          <span className="text-xs font-semibold text-gray-500 min-w-[100px] pt-0.5">{key.replace(/_/g, ' ')}</span>
          <span className="text-gray-700">
            {typeof value === 'object' ? (
              <code className="text-xs bg-gray-50 rounded px-2 py-0.5 font-mono">{JSON.stringify(value)}</code>
            ) : (
              String(value)
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
