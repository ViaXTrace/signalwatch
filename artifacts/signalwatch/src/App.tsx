import React, { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowRight, Bell, Bug, Check, CheckCircle2, ChevronDown, CircleAlert, CircleDot,
  Clock3, Copy, CreditCard, ExternalLink, Eye, EyeOff, FileText, Filter, Gauge,
  Globe2, Inbox, KeyRound, Laptop, Layers3, Link2, LockKeyhole, LogOut, MapPin, Menu,
  MessageSquare, Monitor, Moon, MoreHorizontal, Pause, Pencil, Play, Plus, QrCode, RefreshCw,
  Search, Send, Settings2, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star,
  Sun, Tag, Trash2, Unplug, Upload, UserCircle2, UsersRound, X, Zap,
} from 'lucide-react';
import {
  getGetBillingStatusQueryKey, getGetConnectionStatusQueryKey, getGetDashboardSummaryQueryKey,
  getGetPreferencesQueryKey, getListAlertsQueryKey, getListBillingPlansQueryKey,
  getListGroupsQueryKey, getListRulesQueryKey, useArchiveAlert, useCreateConnectionQr,
  useCreatePixCheckout, useCreateRule, useDeleteRule, useDisconnectTelegram,
  useFavoriteAlert, useGetBillingStatus, useGetConnectionStatus, useGetDashboardSummary,
  useGetPreferences, useListAlerts, useListBillingPlans, useListGroups, useListRules,
  useMarkAlertRead, useRefreshConnection, useSyncGroups, useUpdateGroupMonitoring,
  useUpdatePreferences, useUpdateRule,
} from '@workspace/api-client-react';
import type {
  Alert, BillingPlan, BillingStatus, DashboardSummary, KeywordRule, TelegramConnection,
  TelegramGroup, UserPreference,
} from '@workspace/api-client-react';
import { ClerkProvider, Redirect, Show, SignIn, SignUp, useClerk, useSignIn, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { Link, Redirect as WouterRedirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import Landing from '@/pages/Landing';

const queryClient = new QueryClient();

// ── Theme ──────────────────────────────────────────────────────────────────────
type Theme = 'light' | 'dark';
const ThemeContext = React.createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });
function useTheme() { return useContext(ThemeContext); }

function ThemeProvider({ children }: { children: ReactNode }) {
  // 'vx-theme-explicit' is only written when the user actively toggles the
  // switch. The old key 'vx-theme' was written automatically on every mount by
  // a previous version of this code — we ignore it so system preference works.
  const userChosenRef = useRef<boolean>(!!localStorage.getItem('vx-theme-explicit'));

  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('vx-theme-explicit') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Live-follow system preference whenever the user has not explicitly chosen
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!userChosenRef.current) setTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = useCallback(() => {
    userChosenRef.current = true;
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('vx-theme-explicit', next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
// ──────────────────────────────────────────────────────────────────────────────

// ── Clerk setup ────────────────────────────────────────────────────────────────
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase() || '?';
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#e8531a',
    colorForeground: '#0f0f0f',
    colorMutedForeground: '#6b6560',
    colorDanger: '#de765f',
    colorBackground: '#f4f3ef',
    colorInput: '#ffffff',
    colorInputForeground: '#0f0f0f',
    colorNeutral: '#e0dcd5',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-card rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-foreground font-[var(--app-font-serif)]',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButtonText: 'text-foreground font-semibold',
    formFieldLabel: 'text-foreground font-semibold text-sm',
    footerActionLink: 'text-[#e8531a] font-bold',
    footerActionText: 'text-muted-foreground',
    dividerText: 'text-[#b0aba5] font-bold text-[11px] uppercase tracking-wider',
    identityPreviewEditButton: 'text-[#e8531a]',
    formFieldSuccessText: 'text-[#e8531a]',
    alertText: 'text-foreground',
    logoBox: 'mb-2',
    logoImage: 'h-12 w-12',
    socialButtonsBlockButton: 'border border-border bg-card hover:bg-accent/40',
    badge: '!hidden',
    formButtonPrimary: 'bg-[#e8531a] hover:bg-[#d44517] text-white font-bold',
    formFieldInput: 'border-border bg-card text-foreground focus:border-[#e8531a]',
    footerAction: 'bg-muted',
    dividerLine: 'bg-border',
    alert: 'bg-[#fff8f6] border-[#de765f]',
    otpCodeFieldInput: 'border-border',
    formFieldRow: 'gap-3',
    main: 'gap-5',
  },
};
// ──────────────────────────────────────────────────────────────────────────────

const fallbackConnection: TelegramConnection = {
  status: 'not_connected',
  accountLabel: null,
  authorizedAt: null,
  lastSyncAt: null,
  lastEventAt: null,
  availableGroups: 0,
  monitoringEnabled: false,
  connectorAvailable: false,
  message: 'O conector do Telegram ainda não está disponível neste ambiente.',
};
const fallbackAlerts: Alert[] = [
  { id: 'a-1', groupId: 'g-1', groupName: 'Comercial SP · oportunidades', ruleId: 'r-1', ruleName: 'Licitações de tecnologia', message: 'Empresa pública abre cotação para suporte de rede e segurança. Envio de propostas até sexta-feira.', author: 'Marina C.', matchedKeywords: ['cotação', 'segurança'], receivedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(), status: 'unread', favorite: true, messageLink: null, deliveryStatus: 'internal' },
  { id: 'a-2', groupId: 'g-2', groupName: 'Negócios & Parcerias BR', ruleId: 'r-2', ruleName: 'Parcerias regionais', message: 'Busco parceiro no interior de Minas para distribuição de linha profissional. Operação recorrente.', author: 'Rafael M.', matchedKeywords: ['parceiro', 'distribuição'], receivedAt: new Date(Date.now() - 1000 * 60 * 74).toISOString(), status: 'unread', favorite: false, messageLink: null, deliveryStatus: 'internal' },
  { id: 'a-3', groupId: 'g-3', groupName: 'Fornecedores B2B Brasil', ruleId: 'r-1', ruleName: 'Licitações de tecnologia', message: 'Indicação de fornecedor para implantação de câmeras IP em três unidades. Alguém atende a região Sul?', author: 'João P.', matchedKeywords: ['fornecedor', 'câmeras IP'], receivedAt: new Date(Date.now() - 1000 * 60 * 133).toISOString(), status: 'read', favorite: false, messageLink: null, deliveryStatus: 'internal' },
];
const fallbackGroups: TelegramGroup[] = [
  { id: 'g-1', name: 'Comercial SP · oportunidades', username: 'comercial_sp', status: 'active', monitored: true, messageCount: 18742, lastEventAt: new Date(Date.now() - 1000 * 60 * 3).toISOString(), appliedRules: 4 },
  { id: 'g-2', name: 'Negócios & Parcerias BR', username: 'negocios_parcerias', status: 'active', monitored: true, messageCount: 9360, lastEventAt: new Date(Date.now() - 1000 * 60 * 9).toISOString(), appliedRules: 2 },
  { id: 'g-3', name: 'Fornecedores B2B Brasil', username: 'fornecedores_b2b', status: 'paused', monitored: false, messageCount: 4218, lastEventAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), appliedRules: 1 },
  { id: 'g-4', name: 'Varejo e expansão', username: 'varejo_expansao', status: 'unavailable', monitored: false, messageCount: 0, lastEventAt: null, appliedRules: 0 },
];
const fallbackRules: KeywordRule[] = [
  { id: 'r-1', name: 'Licitações de tecnologia', keywords: ['licitação', 'cotação', 'câmeras IP'], requiredKeywords: [], excludedKeywords: ['curso'], groupIds: ['g-1', 'g-3'], matchType: 'partial', active: true, priority: 82, cooldownMinutes: 60, matchedCount: 38, createdAt: '2025-02-03' },
  { id: 'r-2', name: 'Parcerias regionais', keywords: ['parceiro', 'distribuidor'], requiredKeywords: ['recorrente'], excludedKeywords: [], groupIds: ['g-1', 'g-2'], matchType: 'partial', active: true, priority: 61, cooldownMinutes: 180, matchedCount: 16, createdAt: '2025-01-28' },
  { id: 'r-3', name: 'Imóveis comerciais', keywords: ['ponto comercial', 'galpão'], requiredKeywords: [], excludedKeywords: [], groupIds: ['g-2'], matchType: 'exact', active: false, priority: 34, cooldownMinutes: 360, matchedCount: 7, createdAt: '2025-01-11' },
];
const fallbackSummary: DashboardSummary = { alertsToday: 24, unreadAlerts: 8, activeRules: 2, monitoredGroups: 2, connection: fallbackConnection, planUsage: { planName: 'Pulso', groupsUsed: 2, groupsLimit: 5, keywordsUsed: 6, keywordsLimit: 12, historyDays: 30 }, recentAlerts: fallbackAlerts };
const fallbackPlans: BillingPlan[] = [
  { id: 'pulse', name: 'Pulso', description: 'Para operações comerciais em movimento.', monthlyPriceCents: 7900, annualPriceCents: 75800, groupsLimit: 5, keywordsLimit: 12, destinationsLimit: 1, historyDays: 30, features: ['5 grupos monitorados', '12 palavras-chave', '30 dias de histórico'] },
  { id: 'radar', name: 'Radar', description: 'Para times que precisam cobrir mais terreno.', monthlyPriceCents: 16900, annualPriceCents: 162200, groupsLimit: 20, keywordsLimit: 50, destinationsLimit: 3, historyDays: 90, features: ['20 grupos monitorados', '50 palavras-chave', '90 dias de histórico'] },
  { id: 'sinal', name: 'Sinal', description: 'Inteligência compartilhada para equipes.', monthlyPriceCents: 32900, annualPriceCents: 315800, groupsLimit: 60, keywordsLimit: 160, destinationsLimit: 8, historyDays: 365, features: ['60 grupos monitorados', '160 palavras-chave', '365 dias de histórico'] },
];

function money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function relativeDate(value?: string | null) {
  if (!value) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  if (mins < 1440) return `há ${Math.round(mins / 60)} h`;
  return `há ${Math.round(mins / 1440)} d`;
}
function formatDay(value?: string | null) { return value ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }

function Logo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="brand-logo">
      {/* App icon — always white bg, black curve+dot, orange ring */}
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="9" fill="#ffffff" />
        <path d="M 11 9.5 C 12 20 25.5 15 25.5 27" stroke="#0f0f0f" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <circle cx="11" cy="9.5" r="3.4" fill="#0f0f0f" />
        <circle cx="25.5" cy="27" r="4.5" stroke="#e8531a" strokeWidth="2.8" fill="#ffffff" />
      </svg>
      {/* Wordmark — inherits text color from parent (sidebar-foreground or foreground) */}
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-bold uppercase tracking-[.22em] text-[#e8531a]">ViaX</span>
        <span className="text-base font-bold tracking-[-0.02em]">Trace</span>
      </div>
    </div>
  );
}

function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = { primary: 'bg-[#e8531a] text-[#fff8f4] hover:bg-[#d44517] shadow-[0_7px_18px_rgba(232,83,26,.18)]', secondary: 'border border-border bg-card text-[#c43e12] hover:bg-accent', ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground', danger: 'border border-[#ecc5be] bg-[#fff8f6] text-[#a84032] hover:bg-[#ffebe7]' };
  return <button className={`sw-transition inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
function Pill({ children, tone = 'teal' }: { children: ReactNode; tone?: 'teal' | 'amber' | 'red' | 'slate' | 'blue' }) {
  const colors = { teal: 'bg-[#fde8d4] text-[#d44517]', amber: 'bg-[#fee8da] text-[#c43e12]', red: 'bg-[#ffe5da] text-[#a94335]', slate: 'bg-[#e5eeeb] text-muted-foreground', blue: 'bg-[#dceff3] text-muted-foreground' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${colors[tone]}`}>{children}</span>;
}
function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-lg bg-[#dcebe7] ${className}`} />; }
function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Inbox; title: string; body: string; action?: ReactNode }) {
  return <div className="sw-card flex flex-col items-center justify-center rounded-2xl px-6 py-16 text-center"><div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#fee8da] text-[#d44517]"><Icon size={22} /></div><h3 className="sw-display text-xl font-bold text-foreground">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function ErrorState({ onRetry, label = 'Não foi possível carregar estes dados.' }: { onRetry?: () => void; label?: string }) {
  return <div className="rounded-xl border border-[#eac7bf] bg-[#fff7f4] p-4 text-sm text-[#954b3e]"><div className="flex items-center gap-2 font-semibold"><CircleAlert size={17} /> {label}</div>{onRetry && <button onClick={onRetry} className="mt-2 font-bold underline" data-testid="button-retry">Tentar novamente</button>}</div>;
}

const navItems = [
  { href: '/app', label: 'Visão geral', icon: Gauge, exact: true },
  { href: '/app/alerts', label: 'Alertas', icon: Inbox },
  { href: '/app/rules', label: 'Regras', icon: SlidersHorizontal },
  { href: '/app/groups', label: 'Grupos', icon: UsersRound },
];
const utilityItems = [
  { href: '/app/connection', label: 'Conexão', icon: Link2 },
  { href: '/app/billing', label: 'Plano e cobrança', icon: CreditCard },
  { href: '/app/settings', label: 'Preferências', icon: Settings2 },
];

function NotificationPanel({ alerts, unreadCount, onClose }: { alerts: Alert[]; unreadCount: number; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const recent = alerts.slice(0, 5);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Notificações</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[#e8531a] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          aria-label="Fechar notificações"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell size={28} className="text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Nenhuma notificação pendente.</p>
          </div>
        ) : (
          recent.map(alert => (
            <div
              key={alert.id}
              className={`border-b border-border px-4 py-3 last:border-0 ${alert.status === 'unread' ? 'bg-[#fff8f6] dark:bg-card' : ''}`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${alert.status === 'unread' ? 'bg-[#e8531a]' : 'bg-transparent'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-bold text-[#d44517]">{alert.groupName}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">· {relativeDate(alert.receivedAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-foreground">{alert.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border px-4 py-3">
        <button
          onClick={() => { setLocation('/app/alerts'); onClose(); }}
          className="w-full rounded-lg bg-[#e8531a] py-2 text-xs font-bold text-white hover:bg-[#d44517]"
        >
          Ver todos os alertas
        </button>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const userInitials = initials(user?.fullName ?? user?.firstName ?? '');
  const userName = user?.fullName ?? user?.firstName ?? 'Usuário';
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  // Real unread count — drives sidebar badge and header bell dot
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 30_000 } });
  const unreadCount = summaryQuery.data?.unreadAlerts ?? 0;
  const recentAlerts = summaryQuery.data?.recentAlerts ?? fallbackAlerts;

  // ── Global real-time alert SSE ──────────────────────────────────────────────
  // Keeps a persistent EventSource alive for the entire AppShell lifetime so
  // new alerts update the inbox and badge instantly without a page refresh.
  const qcGlobal = useQueryClient();
  const sseRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(2000);
  const unmounted = useRef(false);

  const connectAlertSSE = useCallback(async () => {
    if (unmounted.current) return;
    try {
      const authResp = await fetch(`${basePath}/api/connection/events/auth`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!authResp.ok || unmounted.current) return;
      const { nonce } = await authResp.json() as { nonce: string };
      if (unmounted.current) return;

      const es = new EventSource(`${basePath}/api/connection/events?nonce=${nonce}`);
      sseRef.current = es;

      es.onmessage = (e: MessageEvent) => {
        const data = JSON.parse(e.data as string) as { type: string };
        if (data.type === 'new_alert') {
          // Invalidate all alert list variants + dashboard summary so every
          // open page (alerts list, header bell, sidebar badge) refreshes.
          qcGlobal.invalidateQueries({ queryKey: getListAlertsQueryKey() });
          qcGlobal.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          reconnectDelay.current = 2000; // reset backoff on successful event
        }
      };

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        if (!unmounted.current) {
          // Exponential backoff capped at 30 s
          reconnectTimer.current = setTimeout(() => {
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
            connectAlertSSE();
          }, reconnectDelay.current);
        }
      };
    } catch {
      if (!unmounted.current) {
        reconnectTimer.current = setTimeout(() => connectAlertSSE(), reconnectDelay.current);
      }
    }
  }, [qcGlobal]);

  useEffect(() => {
    unmounted.current = false;
    connectAlertSSE();
    return () => {
      unmounted.current = true;
      sseRef.current?.close();
      sseRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectAlertSSE]);
  // ───────────────────────────────────────────────────────────────────────────

  const { theme, toggle } = useTheme();
  return (
    <div className="sw-noise min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform border-r border-sidebar-border lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-2"><Logo /></div>
        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/50">Operação</div>
        <nav className="mt-3 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${location === item.href || (!item.exact && location.startsWith(item.href)) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
            >
              <item.icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.label === 'Alertas' && unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-[#e8531a] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/50">Configuração</div>
        <nav className="mt-3 space-y-1">
          {utilityItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${location.startsWith(item.href) ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
              data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
            >
              <item.icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.label === 'Conexão' && <span className="ml-auto h-2 w-2 rounded-full bg-[#e8531a]" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent p-3.5">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-sidebar-foreground">Plano Pulso</span><Pill tone="amber">2 / 5 grupos</Pill></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sidebar-border"><div className="h-full w-[42%] rounded-full bg-[#e8531a]" /></div>
          <Link href="/app/billing" className="mt-3 flex items-center justify-between text-xs font-semibold text-[#e8531a] hover:text-sidebar-foreground" data-testid="link-sidebar-billing">Ver detalhes <ArrowRight size={13} /></Link>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-sidebar-border px-2 pt-3">
          <button
            onClick={toggle}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            data-testid="button-theme-toggle"
          >
            {theme === 'dark'
              ? <><Sun size={14} /><span>Modo claro</span></>
              : <><Moon size={14} /><span>Modo escuro</span></>
            }
          </button>
          <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" aria-label="Sair" data-testid="button-sign-out"><LogOut size={15} /></button>
        </div>
        <div className="mt-2 flex items-center gap-3 px-2 pb-1">
          {user?.imageUrl
            ? <img src={user.imageUrl} className="h-8 w-8 rounded-full object-cover" alt="" />
            : <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e8531a] text-xs font-extrabold text-white">{userInitials}</div>
          }
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-sidebar-foreground">{userName}</div>
            <div className="truncate text-[11px] text-sidebar-foreground/60">{userEmail}</div>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-30 bg-sidebar/40 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" data-testid="button-close-menu" />}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur lg:px-9">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" data-testid="button-open-menu"><Menu size={20} /></button>
            <div className="hidden text-xs font-bold text-muted-foreground sm:block">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div className="text-sm font-semibold text-foreground sm:hidden">{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/app/connection" className="hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent sm:flex" data-testid="link-header-connection">
              <span className="h-2 w-2 rounded-full bg-[#e8531a]" /> Telegram não conectado
            </Link>
            {/* Bell — opens notification panel */}
            <div className="relative">
              <button
                className="relative rounded-lg p-2.5 text-muted-foreground hover:bg-accent"
                aria-label="Notificações"
                data-testid="button-notifications"
                onClick={() => setNotifOpen(o => !o)}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#de765f]" />}
              </button>
              {notifOpen && (
                <NotificationPanel
                  alerts={recentAlerts}
                  unreadCount={unreadCount}
                  onClose={() => setNotifOpen(false)}
                />
              )}
            </div>
            {user?.imageUrl
              ? <img src={user.imageUrl} className="h-8 w-8 rounded-full object-cover" alt="" />
              : <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e8531a] text-xs font-extrabold text-foreground">{userInitials}</div>
            }
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-5 py-7 lg:px-9 lg:py-9">{children}</main>
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[#d44517]"><span className="h-1.5 w-1.5 rounded-full bg-[#e8531a]" />{eyebrow}</div><h1 className="sw-display text-[2.15rem] font-bold leading-none tracking-[-.045em] text-foreground lg:text-[2.55rem]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}

function Metric({ label, value, note, icon: Icon, tone = 'teal' }: { label: string; value: string | number; note: string; icon: typeof Activity; tone?: 'teal' | 'amber' | 'blue' }) {
  const iconColor = { teal: 'bg-[#fee8da] text-[#d44517]', amber: 'bg-[#fee8da] text-[#c43e12]', blue: 'bg-[#dff2f3] text-muted-foreground' };
  return <div className="sw-card rounded-2xl p-5"><div className="flex items-start justify-between"><div className="text-xs font-bold uppercase tracking-[.09em] text-muted-foreground">{label}</div><div className={`grid h-9 w-9 place-items-center rounded-xl ${iconColor[tone]}`}><Icon size={17} /></div></div><div className="mt-5 sw-display text-4xl font-bold tracking-[-.05em] text-foreground">{value}</div><div className="mt-1 text-xs font-medium text-muted-foreground">{note}</div></div>;
}

function AlertRow({ alert, onRead, onFavorite, onArchive }: { alert: Alert; onRead?: () => void; onFavorite?: () => void; onArchive?: () => void }) {
  return (
    <article
      className={`sw-transition group relative rounded-xl border p-4 ${alert.status === 'unread' ? 'border-[#f0c8b0] bg-card' : 'border-border bg-card'}`}
      data-testid={`card-alert-${alert.id}`}
    >
      <div className="flex gap-3">
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${alert.status === 'unread' ? 'bg-[#e6b548]' : 'bg-[#e0dcd5]'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold text-[#d44517]">{alert.groupName}</span>
            <span className="text-[11px] text-muted-foreground">· {relativeDate(alert.receivedAt)}</span>
            {alert.deliveryStatus === 'unavailable' && <Pill tone="amber">Entrega indisponível</Pill>}
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground">{alert.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {alert.matchedKeywords.map(k => (
              <span key={k} className="rounded-md bg-[#fee8da] px-2 py-1 font-mono text-[10px] font-medium text-[#d44517]">#{k}</span>
            ))}
            <span className="ml-1 text-[11px] text-muted-foreground">regra: {alert.ruleName}</span>
          </div>
          {/* Telegram deep link */}
          {alert.messageLink && (
            <a
              href={alert.messageLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-2.5 py-1.5 text-[11px] font-semibold text-[#d44517] hover:bg-accent"
              data-testid={`link-open-telegram-${alert.id}`}
            >
              <ExternalLink size={11} />
              Abrir no Telegram
            </a>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          <button onClick={onFavorite} className={`rounded-md p-2 hover:bg-[#fee8da] ${alert.favorite ? 'text-[#c43e12]' : 'text-muted-foreground'}`} aria-label="Favoritar alerta" data-testid={`button-favorite-${alert.id}`}>
            <Star size={16} fill={alert.favorite ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onRead} className="rounded-md p-2 text-muted-foreground hover:bg-[#fee8da]" aria-label={alert.status === 'unread' ? 'Marcar como lido' : 'Marcar como não lido'} data-testid={`button-read-${alert.id}`}>
            {alert.status === 'unread' ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button onClick={onArchive} className="rounded-md p-2 text-muted-foreground hover:bg-[#fee8da]" aria-label="Arquivar alerta" data-testid={`button-archive-${alert.id}`}>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

function Dashboard() {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { user } = useUser();
  const summary = summaryQuery.data ?? fallbackSummary;
  const health = summaryQuery.isError;
  const firstName = user?.firstName ?? user?.fullName?.split(' ')[0] ?? 'você';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return <><PageHeader eyebrow="Pulso de hoje" title={`${greeting}, ${firstName}.`} description="Seu radar está de olho. Aqui está o que merece atenção agora." action={<Link href="/app/alerts" className="inline-flex items-center gap-2 rounded-lg bg-[#e8531a] px-4 py-2.5 text-sm font-bold text-[#fff8f4] shadow-[0_7px_18px_rgba(232,83,26,.18)] hover:bg-[#d44517]" data-testid="link-see-all-alerts">Abrir inbox <ArrowRight size={16} /></Link>} />
    {health && <div className="mb-5"><ErrorState onRetry={() => summaryQuery.refetch()} label="O servidor não respondeu. Exibindo o último panorama disponível." /></div>}
    {summaryQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Alertas hoje" value={summary.alertsToday} note={`${summary.unreadAlerts} ainda não lidos`} icon={Inbox} /><Metric label="Regras ativas" value={summary.activeRules} note="cobrindo seus temas" icon={Zap} tone="amber" /><Metric label="Grupos monitorados" value={summary.monitoredGroups} note={`${summary.connection.availableGroups} disponíveis`} icon={Layers3} tone="blue" /><Metric label="Conexão" value={summary.connection.status === 'connected' ? 'Ativa' : 'Pendente'} note={summary.connection.connectorAvailable ? 'Telegram autorizado' : 'conector indisponível'} icon={Activity} tone={summary.connection.status === 'connected' ? 'teal' : 'amber'} /></div>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]"><section className="sw-card rounded-2xl p-5 lg:p-6"><div className="flex items-center justify-between"><div><h2 className="sw-display text-xl font-bold text-foreground">Sinais recentes</h2><p className="mt-1 text-xs text-muted-foreground">O que cruzou suas regras nas últimas horas.</p></div><Link href="/app/alerts" className="text-xs font-bold text-[#d44517] hover:underline" data-testid="link-recent-alerts">Ver todos</Link></div><div className="mt-5 space-y-2">{summary.recentAlerts.length ? summary.recentAlerts.slice(0, 4).map(a => <AlertRow key={a.id} alert={a} />) : <EmptyState icon={Inbox} title="Nenhum sinal ainda" body="Quando uma mensagem cruzar suas regras, ela aparecerá neste espaço." />}</div></section><aside className="space-y-6"><section className="sw-card rounded-2xl p-5 lg:p-6"><div className="flex items-center justify-between"><div><h2 className="sw-display text-xl font-bold text-foreground">Uso do plano</h2><p className="mt-1 text-xs text-muted-foreground">{summary.planUsage.planName}</p></div><Link href="/app/billing" className="text-xs font-bold text-[#d44517] hover:underline" data-testid="link-usage-billing">Detalhes</Link></div><UsageBar label="Grupos" used={summary.planUsage.groupsUsed} limit={summary.planUsage.groupsLimit} /><UsageBar label="Palavras-chave" used={summary.planUsage.keywordsUsed} limit={summary.planUsage.keywordsLimit} /></section><section className="rounded-2xl bg-accent p-5 lg:p-6"><div className="flex items-center gap-2 text-[#d44517]"><CircleDot size={16} className="sw-scan" /><span className="text-xs font-bold uppercase tracking-[.15em]">Próximo passo</span></div><h3 className="sw-display mt-4 text-xl font-bold leading-tight text-foreground">{summary.connection.connectorAvailable ? 'Revise os alertas de maior intenção.' : 'Conecte seu Telegram para começar.'}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{summary.connection.connectorAvailable ? 'Comece pelos sinais não lidos e ajuste uma regra se o ruído aumentou.' : 'A integração está aguardando disponibilidade do conector. Você poderá autorizar sua conta sem compartilhar sua senha.'}</p><Link href={summary.connection.connectorAvailable ? '/app/alerts' : '/app/connection'} className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#d44517] hover:gap-3" data-testid="link-next-step">{summary.connection.connectorAvailable ? 'Ir para inbox' : 'Ver conexão'} <ArrowRight size={15} /></Link></section></aside></div>
  </>;
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return <div className="mt-5"><div className="flex justify-between text-xs font-semibold text-muted-foreground"><span>{label}</span><span className="sw-mono text-[#252525]">{used} <span className="text-[#b0aba5]">/ {limit}</span></span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dcebe6]"><div className={`h-full rounded-full ${pct > 80 ? 'bg-[#df9d45]' : 'bg-[#e8531a]'}`} style={{ width: `${pct}%` }} /></div></div>;
}

function AlertsPage() {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const params = useMemo(() => ({ search: search || undefined, period, status: 'all' as const, limit: 50 }), [search, period]);
  const query = useListAlerts(params, { query: { queryKey: getListAlertsQueryKey(params) } });
  const alerts = query.data ?? fallbackAlerts.filter(a => !search || `${a.message} ${a.groupName} ${a.ruleName}`.toLowerCase().includes(search.toLowerCase()));
  const qc = useQueryClient();
  const mark = useMarkAlertRead(); const fav = useFavoriteAlert(); const archive = useArchiveAlert();
  const invalidate = () => qc.invalidateQueries({ queryKey: getListAlertsQueryKey(params) });
  const action = (mut: typeof mark, id: string, data: object, success: string) => mut.mutate({ alertId: id, data } as never, { onSuccess: () => { invalidate(); toast({ title: success }); }, onError: () => toast({ title: 'Ação não concluída', description: 'Tente novamente em instantes.', variant: 'destructive' }) });
  return <><PageHeader eyebrow="Caixa de entrada" title="Alertas" description="Oportunidades filtradas das conversas que você não tem tempo de acompanhar." action={<Button onClick={() => query.refetch()} variant="secondary" disabled={query.isFetching} data-testid="button-refresh-alerts"><RefreshCw size={15} className={query.isFetching ? 'animate-spin' : ''} /> Atualizar</Button>} /><div className="sw-card rounded-2xl p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search size={17} className="absolute left-3.5 top-3.5 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por mensagem, grupo ou regra" className="h-11 w-full rounded-lg border border-border bg-card pl-10 pr-4 text-sm outline-none ring-[#78736e] placeholder:text-muted-foreground focus:ring-2" data-testid="input-search-alerts" /></div><div className="flex items-center gap-2 overflow-x-auto"><Filter size={15} className="text-muted-foreground" />{(['today', '7d', '30d', 'all'] as const).map(item => <button key={item} onClick={() => setPeriod(item)} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${period === item ? 'bg-[#fee8da] text-[#1a1a1a]' : 'text-muted-foreground hover:bg-[#e5f2ed]'}`} data-testid={`button-period-${item}`}>{item === 'today' ? 'Hoje' : item === '7d' ? '7 dias' : item === '30d' ? '30 dias' : 'Tudo'}</button>)}</div></div></div><div className="mt-5 flex items-center justify-between"><div className="text-xs font-semibold text-muted-foreground"><span className="sw-mono text-[#252525]">{alerts.length}</span> sinais encontrados</div><div className="flex gap-2"><Pill tone="teal"><span className="h-1.5 w-1.5 rounded-full bg-current" /> internos</Pill><Pill tone="amber">Telegram conectado: não</Pill></div></div><div className="mt-3 space-y-2">{query.isLoading ? [1, 2, 3].map(i => <Skeleton key={i} className="h-40" />) : query.isError && !query.data ? <ErrorState onRetry={() => query.refetch()} /> : alerts.length ? alerts.map(a => <AlertRow key={a.id} alert={a} onRead={() => action(mark, a.id, { read: a.status !== 'unread' }, a.status === 'unread' ? 'Alerta marcado como lido.' : 'Alerta marcado como não lido.')} onFavorite={() => action(fav, a.id, { favorite: !a.favorite }, a.favorite ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.')} onArchive={() => action(archive, a.id, { archived: true }, 'Alerta arquivado.')} />) : <EmptyState icon={Search} title="Nada cruzou esse filtro" body="Tente outra palavra ou amplie o período para encontrar um sinal." action={<Button variant="secondary" onClick={() => { setSearch(''); setPeriod('all'); }} data-testid="button-clear-alert-filters">Limpar filtros</Button>} />}</div></>;
}

type RuleForm = { name: string; keywords: string; requiredKeywords: string; excludedKeywords: string; groupIds: string[]; matchType: 'partial' | 'exact' | 'regex'; active: boolean; priority: number; cooldownMinutes: number };
const blankRule: RuleForm = { name: '', keywords: '', requiredKeywords: '', excludedKeywords: '', groupIds: ['g-1'], matchType: 'partial', active: true, priority: 50, cooldownMinutes: 60 };
function RuleModal({ initial, groups, onClose, onSaved }: { initial?: KeywordRule; groups: TelegramGroup[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<RuleForm>(initial ? { name: initial.name, keywords: initial.keywords.join(', '), requiredKeywords: (initial.requiredKeywords ?? []).join(', '), excludedKeywords: (initial.excludedKeywords ?? []).join(', '), groupIds: initial.groupIds, matchType: initial.matchType, active: initial.active, priority: initial.priority, cooldownMinutes: initial.cooldownMinutes } : blankRule);
  const create = useCreateRule(); const update = useUpdateRule(); const qc = useQueryClient();
  const save = () => { const payload = { name: form.name.trim(), keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean), requiredKeywords: form.requiredKeywords.split(',').map(s => s.trim()).filter(Boolean), excludedKeywords: form.excludedKeywords.split(',').map(s => s.trim()).filter(Boolean), groupIds: form.groupIds, matchType: form.matchType, active: form.active, priority: Number(form.priority), cooldownMinutes: Number(form.cooldownMinutes) }; if (!payload.name || !payload.keywords.length || !payload.groupIds.length) { toast({ title: 'Preencha nome, palavras e ao menos um grupo.', variant: 'destructive' }); return; } const options = { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRulesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); toast({ title: initial ? 'Regra atualizada.' : 'Regra criada.', description: 'O radar já pode usar esta configuração.' }); onSaved(); }, onError: () => toast({ title: 'Não foi possível salvar a regra.', variant: 'destructive' }) }; initial ? update.mutate({ ruleId: initial.id, data: payload }, options) : create.mutate({ data: payload }, options); };
  const set = (key: keyof RuleForm, value: string | boolean | string[] | number) => setForm(prev => ({ ...prev, [key]: value }));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5"><div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">{initial ? 'Editar regra' : 'Nova regra'}</div><h2 className="sw-display mt-1 text-2xl font-bold text-foreground">{initial ? initial.name : 'Dê um nome ao seu sinal'}</h2></div><button className="rounded-lg p-2 text-muted-foreground hover:bg-accent" onClick={onClose} aria-label="Fechar formulário" data-testid="button-close-rule-modal"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Nome da regra"><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Expansão no interior" className="form-input" data-testid="input-rule-name" /></Field><Field label="Tipo de correspondência"><select value={form.matchType} onChange={e => set('matchType', e.target.value)} className="form-input" data-testid="select-rule-match-type"><option value="partial">Parcial — encontra variações</option><option value="exact">Exata — termo completo</option><option value="regex">Regex — padrão avançado</option></select></Field><Field label="Palavras-chave" hint="Separe por vírgulas"><input value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="licitação, cotação, fornecedor" className="form-input" data-testid="input-rule-keywords" /></Field><Field label="Palavras obrigatórias"><input value={form.requiredKeywords} onChange={e => set('requiredKeywords', e.target.value)} placeholder="opcional" className="form-input" data-testid="input-rule-required" /></Field><Field label="Excluir palavras"><input value={form.excludedKeywords} onChange={e => set('excludedKeywords', e.target.value)} placeholder="curso, vaga" className="form-input" data-testid="input-rule-excluded" /></Field><Field label="Cooldown (minutos)"><input type="number" min="0" value={form.cooldownMinutes} onChange={e => set('cooldownMinutes', Number(e.target.value))} className="form-input" data-testid="input-rule-cooldown" /></Field></div><div className="mt-5"><div className="mb-2 text-xs font-bold text-foreground">Grupos monitorados</div><div className="grid gap-2 sm:grid-cols-2">{groups.filter(g => g.status !== 'unavailable').map(g => <label key={g.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors ${form.groupIds.includes(g.id) ? 'border-primary/40 bg-accent text-foreground' : 'border-border text-foreground hover:bg-muted'}`}><input type="checkbox" checked={form.groupIds.includes(g.id)} onChange={e => set('groupIds', e.target.checked ? [...form.groupIds, g.id] : form.groupIds.filter(id => id !== g.id))} className="accent-primary" data-testid={`checkbox-rule-group-${g.id}`} /><span className="truncate font-semibold">{g.name}</span></label>)}</div></div><div className="mt-5 flex items-center gap-5"><Field label="Prioridade"><input type="range" min="0" max="100" value={form.priority} onChange={e => set('priority', Number(e.target.value))} className="w-full accent-primary" data-testid="input-rule-priority" /></Field><div className="sw-mono min-w-[2.5rem] text-center text-sm font-bold text-foreground">{form.priority}%</div><label className="ml-auto flex items-center gap-2 text-sm font-semibold text-muted-foreground"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} className="accent-primary" data-testid="checkbox-rule-active" /> Ativa agora</label></div><div className="mt-7 flex justify-end gap-2"><Button variant="secondary" onClick={onClose} data-testid="button-cancel-rule">Cancelar</Button><Button onClick={save} disabled={create.isPending || update.isPending} data-testid="button-save-rule">{create.isPending || update.isPending ? 'Salvando…' : initial ? 'Salvar alterações' : 'Criar regra'}</Button></div></div></div>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="block text-xs font-bold text-foreground"><span>{label} {hint && <em className="font-normal not-italic text-muted-foreground">· {hint}</em>}</span><div className="mt-1.5">{children}</div></label>; }

function RulesPage() {
  const query = useListRules({ query: { queryKey: getListRulesQueryKey() } }); const groupsQuery = useListGroups(undefined, { query: { queryKey: getListGroupsQueryKey() } });
  const groups = groupsQuery.data ?? fallbackGroups; const rules = query.data ?? fallbackRules; const [editing, setEditing] = useState<KeywordRule | null | undefined>(undefined); const [search, setSearch] = useState('');
  const del = useDeleteRule(); const update = useUpdateRule(); const qc = useQueryClient();
  const filtered = rules.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.keywords.join(' ').toLowerCase().includes(search.toLowerCase()));
  const toggle = (rule: KeywordRule) => update.mutate({ ruleId: rule.id, data: { name: rule.name, keywords: rule.keywords, requiredKeywords: rule.requiredKeywords ?? [], excludedKeywords: rule.excludedKeywords ?? [], groupIds: rule.groupIds, matchType: rule.matchType, active: !rule.active, priority: rule.priority, cooldownMinutes: rule.cooldownMinutes } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRulesQueryKey() }); toast({ title: rule.active ? 'Regra pausada.' : 'Regra ativada.' }); }, onError: () => toast({ title: 'Não foi possível atualizar a regra.', variant: 'destructive' }) });
  const remove = (rule: KeywordRule) => { if (!window.confirm(`Excluir a regra “${rule.name}”?`)) return; del.mutate({ ruleId: rule.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListRulesQueryKey() }); toast({ title: 'Regra excluída.' }); }, onError: () => toast({ title: 'Não foi possível excluir a regra.', variant: 'destructive' }) }); };
  return <><PageHeader eyebrow="Lógica do radar" title="Regras" description="Diga ao ViaX: Trace o que merece virar sinal — e o que é só ruído." action={<Button onClick={() => setEditing(null)} data-testid="button-new-rule"><Plus size={16} /> Nova regra</Button>} /><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-sm flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar regras" className="form-input pl-9" data-testid="input-search-rules" /></div><div className="text-xs font-semibold text-muted-foreground"><span className="sw-mono text-foreground">{rules.filter(r => r.active).length}</span> ativas · <span className="sw-mono text-foreground">{rules.reduce((sum, r) => sum + r.matchedCount, 0)}</span> correspondências</div></div>{query.isError && !query.data && <ErrorState onRetry={() => query.refetch()} />}{query.isLoading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : filtered.length ? <div className="space-y-3">{filtered.map(rule => <div key={rule.id} className="sw-card sw-transition rounded-2xl p-5 hover:-translate-y-0.5" data-testid={`card-rule-${rule.id}`}><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="flex min-w-0 flex-1 items-start gap-3"><div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${rule.active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}><Tag size={17} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-foreground">{rule.name}</h3>{rule.active ? <Pill tone="teal"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Ativa</Pill> : <Pill tone="slate">Pausada</Pill>}</div><div className="mt-2 flex flex-wrap gap-1.5">{rule.keywords.map(k => <span key={k} className="rounded bg-accent/60 px-2 py-1 font-mono text-[10px] text-foreground">#{k}</span>)}</div><div className="mt-2 text-xs text-muted-foreground">{rule.matchType === 'partial' ? 'Correspondência parcial' : rule.matchType === 'exact' ? 'Correspondência exata' : 'Expressão regular'} · {rule.groupIds.length} {rule.groupIds.length === 1 ? 'grupo' : 'grupos'} · prioridade {rule.priority}</div></div></div><div className="grid grid-cols-2 gap-5 border-t border-border pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0"><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Encontrados</div><div className="sw-mono mt-1 text-lg font-bold text-foreground">{rule.matchedCount}</div></div><div><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cooldown</div><div className="sw-mono mt-1 text-lg font-bold text-foreground">{rule.cooldownMinutes}m</div></div></div><div className="flex items-center gap-1 md:ml-2"><button onClick={() => toggle(rule)} className="rounded-lg p-2 text-foreground hover:bg-accent" aria-label={rule.active ? 'Pausar regra' : 'Ativar regra'} data-testid={`button-toggle-rule-${rule.id}`}>{rule.active ? <Pause size={17} /> : <Play size={17} />}</button><button onClick={() => setEditing(rule)} className="rounded-lg p-2 text-foreground hover:bg-accent" aria-label="Editar regra" data-testid={`button-edit-rule-${rule.id}`}><Pencil size={17} /></button><button onClick={() => remove(rule)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="Excluir regra" data-testid={`button-delete-rule-${rule.id}`}><Trash2 size={17} /></button></div></div></div>)}</div> : <EmptyState icon={SlidersHorizontal} title="Comece com uma regra clara" body="Uma boa regra transforma conversas dispersas em oportunidades que sua equipe consegue agir." action={<Button onClick={() => setEditing(null)} data-testid="button-empty-new-rule"><Plus size={16} /> Criar primeira regra</Button>} />}{editing !== undefined && <RuleModal initial={editing || undefined} groups={groups} onClose={() => setEditing(undefined)} onSaved={() => setEditing(undefined)} />}</>;
}

function GroupsPage() {
  const query = useListGroups(undefined, { query: { queryKey: getListGroupsQueryKey() } }); const groups = query.data ?? fallbackGroups; const sync = useSyncGroups(); const update = useUpdateGroupMonitoring(); const qc = useQueryClient(); const [search, setSearch] = useState('');
  const filtered = groups.filter(g => `${g.name} ${g.username ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const syncNow = () => sync.mutate(undefined, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }); toast({ title: 'Grupos atualizados.' }); }, onError: () => toast({ title: 'Não foi possível sincronizar grupos.', description: 'Verifique a conexão com o Telegram.', variant: 'destructive' }) });
  const toggle = (g: TelegramGroup) => update.mutate({ groupId: g.id, data: { monitored: !g.monitored } }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListGroupsQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); toast({ title: g.monitored ? 'Monitoramento pausado.' : 'Monitoramento iniciado.' }); }, onError: () => toast({ title: 'Não foi possível alterar o monitoramento.', variant: 'destructive' }) });
  return <><PageHeader eyebrow="Território monitorado" title="Grupos" description="Escolha onde o radar presta atenção. Grupos pausados continuam disponíveis para reativação." action={<Button variant="secondary" onClick={syncNow} disabled={sync.isPending} data-testid="button-sync-groups"><RefreshCw size={15} className={sync.isPending ? 'animate-spin' : ''} /> Sincronizar grupos</Button>} /><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative max-w-sm flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar grupo" className="form-input pl-9" data-testid="input-search-groups" /></div><div className="flex gap-2"><Pill tone="teal">{groups.filter(g => g.monitored).length} monitorados</Pill><Pill tone="slate">{groups.length} disponíveis</Pill></div></div>{query.isError && !query.data && <ErrorState onRetry={() => query.refetch()} />}{query.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36" />)}</div> : <div className="grid gap-3 md:grid-cols-2">{filtered.map(g => <div key={g.id} className="sw-card sw-transition rounded-2xl p-5 hover:-translate-y-0.5" data-testid={`card-group-${g.id}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fee8da] text-[#252525]"><MessageSquare size={18} /></div><div className="min-w-0"><h3 className="truncate font-bold text-[#1a1a1a]">{g.name}</h3><div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{g.username ? `@${g.username}` : 'grupo sem username'}</div></div></div>{g.status === 'unavailable' ? <Pill tone="amber">Indisponível</Pill> : g.monitored ? <Pill tone="teal"><span className="h-1.5 w-1.5 rounded-full bg-current" /> Monitorando</Pill> : <Pill tone="slate">Pausado</Pill>}</div><div className="mt-5 grid grid-cols-3 border-t border-border pt-4 text-xs"><div><div className="text-muted-foreground">Mensagens</div><div className="sw-mono mt-1 font-bold text-[#252525]">{g.messageCount.toLocaleString('pt-BR')}</div></div><div><div className="text-muted-foreground">Regras</div><div className="sw-mono mt-1 font-bold text-[#252525]">{g.appliedRules ?? 0}</div></div><div><div className="text-muted-foreground">Último sinal</div><div className="mt-1 font-semibold text-[#252525]">{relativeDate(g.lastEventAt)}</div></div></div><button disabled={g.status === 'unavailable'} onClick={() => toggle(g)} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold ${g.monitored ? 'bg-[#e4f4ed] text-[#252525] hover:bg-[#fee8da]' : 'border border-border text-foreground hover:bg-[#eef8f4]'} disabled:opacity-50`} data-testid={`button-toggle-group-${g.id}`}>{g.monitored ? <><Pause size={14} /> Pausar monitoramento</> : <><Play size={14} /> Monitorar grupo</>}</button></div>)}</div>}{!filtered.length && <EmptyState icon={UsersRound} title="Nenhum grupo encontrado" body="Sincronize sua conta autorizada para descobrir novos grupos." />}</>;
}

function ConnectionPage({ onboarding = false }: { onboarding?: boolean }) {
  const query = useGetConnectionStatus({ query: { queryKey: getGetConnectionStatusQueryKey() } });
  const connection = query.data ?? fallbackConnection;
  const qr = useCreateConnectionQr();
  const refresh = useRefreshConnection();
  const disconnect = useDisconnectTelegram();
  const qc = useQueryClient();
  // QR + SSE state
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const sseRef = useRef<EventSource | null>(null);

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [password2FA, setPassword2FA] = useState('');
  const [submitting2FA, setSubmitting2FA] = useState(false);
  const [error2FA, setError2FA] = useState('');

  // QR expiry countdown
  useEffect(() => {
    if (!qrExpiresAt) { setQrSecondsLeft(0); return; }
    const tick = () => setQrSecondsLeft(Math.max(0, Math.round((qrExpiresAt.getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [qrExpiresAt]);

  // Cleanup SSE on unmount
  useEffect(() => () => { sseRef.current?.close(); }, []);

  async function openSSE() {
    sseRef.current?.close();
    try {
      const authResp = await fetch(`${basePath}/api/connection/events/auth`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!authResp.ok) return;
      const { nonce } = await authResp.json() as { nonce: string };
      const es = new EventSource(`${basePath}/api/connection/events?nonce=${nonce}`);
      sseRef.current = es;
      es.onmessage = (e: MessageEvent) => {
        const data = JSON.parse(e.data as string) as { type: string; dataUrl?: string; expiresAt?: string; accountLabel?: string; message?: string };
        if (data.type === 'ping') return;
        if (data.type === 'qr') {
          setQrData(data.dataUrl ?? null);
          setQrExpiresAt(data.expiresAt ? new Date(data.expiresAt) : null);
          setQrError(null);
        }
        if (data.type === 'connected') {
          setQrData(null);
          setQrExpiresAt(null);
          setShow2FA(false);
          qc.invalidateQueries({ queryKey: getGetConnectionStatusQueryKey() });
          toast({ title: '✓ Telegram conectado!', description: data.accountLabel ?? 'Sua sessão está ativa.' });
          es.close();
          sseRef.current = null;
        }
        if (data.type === 'needs_2fa') {
          setShow2FA(true);
        }
        if (data.type === 'error') {
          setQrError(data.message ?? 'Erro durante a autorização.');
          setQrData(null);
        }
      };
      es.onerror = () => { /* connection closed or network error — silently close */ es.close(); };
    } catch { /* network error — ignore */ }
  }

  const startQr = () => {
    setQrError(null);
    openSSE();
    qr.mutate(undefined, {
      onSuccess: result => {
        if (result.qrData) { setQrData(result.qrData); setQrExpiresAt(result.expiresAt ? new Date(result.expiresAt as unknown as string) : null); }
        qc.invalidateQueries({ queryKey: getGetConnectionStatusQueryKey() });
      },
      onError: () => toast({ title: 'Telegram indisponível.', description: 'O conector ainda não pode iniciar uma autorização neste ambiente.', variant: 'destructive' }),
    });
  };

  const doRefresh = () => refresh.mutate(undefined, {
    onSuccess: () => { qc.invalidateQueries({ queryKey: getGetConnectionStatusQueryKey() }); toast({ title: 'Status atualizado.' }); },
    onError: () => toast({ title: 'Não foi possível atualizar a conexão.', variant: 'destructive' }),
  });

  const doDisconnect = () => disconnect.mutate(undefined, {
    onSuccess: () => { qc.invalidateQueries({ queryKey: getGetConnectionStatusQueryKey() }); toast({ title: 'Sessão desconectada.' }); },
    onError: () => toast({ title: 'Não foi possível desconectar.', variant: 'destructive' }),
  });

  const submit2FA = async () => {
    if (!password2FA.trim()) return;
    setSubmitting2FA(true);
    setError2FA('');
    try {
      const resp = await fetch(`${basePath}/api/connection/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password: password2FA }),
      });
      if (!resp.ok) throw new Error('failed');
      setPassword2FA('');
      toast({ title: 'Senha enviada.', description: 'Aguardando confirmação do Telegram…' });
    } catch {
      setError2FA('Senha incorreta ou expirada. Tente novamente.');
    } finally {
      setSubmitting2FA(false);
    }
  };

  const unavailable = !connection.connectorAvailable || connection.status === 'unavailable';
  const showingQr = !!qrData && !unavailable && connection.status !== 'connected';

  return (
    <>
      {!onboarding && (
        <PageHeader
          eyebrow="Fonte dos sinais"
          title="Conexão Telegram"
          description="Uma sessão pessoal e protegida para ler os grupos que você escolheu. O ViaX: Trace nunca pede sua senha."
          action={<Button variant="secondary" onClick={doRefresh} disabled={refresh.isPending} data-testid="button-refresh-connection"><RefreshCw size={15} /> Atualizar status</Button>}
        />
      )}

      {/* 2FA modal */}
      {show2FA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f0f0f]/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fee8da] text-[#9c6e1a]">
                <KeyRound size={20} />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">Verificação em duas etapas</div>
                <h2 className="sw-display text-xl font-bold text-foreground">Insira sua senha do Telegram</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground">
              Sua conta tem verificação em duas etapas ativa. Insira a senha que você configurou no Telegram para continuar.
            </p>
            <div className="mt-5">
              <input
                type="password"
                value={password2FA}
                onChange={e => { setPassword2FA(e.target.value); setError2FA(''); }}
                onKeyDown={e => e.key === 'Enter' && submit2FA()}
                placeholder="Senha do Telegram"
                className="form-input w-full"
                autoFocus
                data-testid="input-2fa-password"
              />
              {error2FA && <p className="mt-2 text-xs font-medium text-[#de765f]">{error2FA}</p>}
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setShow2FA(false); setPassword2FA(''); setError2FA(''); }}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-bold text-muted-foreground hover:bg-accent"
                data-testid="button-cancel-2fa"
              >Cancelar</button>
              <button
                onClick={submit2FA}
                disabled={submitting2FA || !password2FA.trim()}
                className="flex-1 rounded-lg bg-[#e8531a] py-2.5 text-sm font-bold text-white hover:bg-[#d44517] disabled:opacity-50"
                data-testid="button-submit-2fa"
              >{submitting2FA ? 'Enviando…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      <div className={`grid gap-6 ${onboarding ? '' : 'xl:grid-cols-[.8fr_1.2fr]'}`}>
        {/* Left panel — session state */}
        <section className="sw-card rounded-2xl p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-xl ${unavailable ? 'bg-[#fee8da] text-[#a4751c]' : connection.status === 'connected' ? 'bg-[#fee8da] text-[#e8531a]' : 'bg-accent text-foreground'}`}>
              <Link2 size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">Estado da sessão</div>
              <h2 className="sw-display text-2xl font-bold text-foreground">
                {unavailable ? 'Conector indisponível' : connection.status === 'connected' ? 'Telegram conectado' : showingQr ? 'Aguardando escaneamento' : 'Aguardando autorização'}
              </h2>
            </div>
          </div>

          <div className="mt-7 rounded-xl bg-accent/50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground"><ShieldCheck size={17} /> Privacidade por desenho</div>
            <p className="mt-2 text-sm leading-6 text-foreground">Sua sessão fica vinculada à sua conta. Nenhum grupo é monitorado até você escolher ativá-lo.</p>
          </div>

          {unavailable ? (
            <div className="mt-6 rounded-xl border border-[#fcc4a0] bg-[#fff4ee] p-4">
              <div className="flex items-center gap-2 font-bold text-[#c43e12]"><CircleAlert size={17} /> Integração temporariamente indisponível</div>
              <p className="mt-2 text-sm leading-6 text-[#c43e12]">{connection.message ?? 'O conector do Telegram não está disponível. Tente novamente quando o serviço for habilitado.'}</p>
            </div>
          ) : connection.status === 'connected' ? (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <div className="text-xs text-muted-foreground">Conta autorizada</div>
                  <div className="mt-1 font-bold text-foreground">{connection.accountLabel ?? 'Conta Telegram'}</div>
                </div>
                <Pill tone="teal"><Check size={12} /> Ativa</Pill>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-accent/50 p-4">
                  <div className="text-xs text-muted-foreground">Última sincronização</div>
                  <div className="mt-1 text-sm font-bold text-foreground">{formatDay(connection.lastSyncAt)}</div>
                </div>
                <div className="rounded-xl bg-accent/50 p-4">
                  <div className="text-xs text-muted-foreground">Último evento</div>
                  <div className="mt-1 text-sm font-bold text-foreground">{formatDay(connection.lastEventAt)}</div>
                </div>
              </div>
              <Button variant="danger" onClick={doDisconnect} disabled={disconnect.isPending} data-testid="button-disconnect-telegram">
                <Unplug size={15} /> Desconectar sessão
              </Button>
            </div>
          ) : (
            <>
              {qrError && (
                <div className="mt-4 rounded-xl border border-[#fcc4a0] bg-[#fff4ee] p-3 text-sm text-[#c43e12]">
                  <span className="font-bold">Erro: </span>{qrError}
                </div>
              )}
              <Button
                onClick={startQr}
                disabled={qr.isPending}
                className="mt-6 w-full"
                data-testid="button-start-telegram-qr"
              >
                <QrCode size={17} /> {qr.isPending ? 'Preparando autorização…' : showingQr ? 'Gerar novo QR code' : 'Autorizar com QR code'}
              </Button>
            </>
          )}
        </section>

        {/* Right panel — QR code */}
        {!onboarding && (
          <section className="sw-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">Autorização</div>
                <h2 className="sw-display mt-1 text-2xl font-bold text-foreground">Conecte sem compartilhar senha</h2>
              </div>
              <div className="text-muted-foreground"><LockKeyhole size={22} /></div>
            </div>

            {showingQr ? (
              <div className="mt-7 flex flex-col items-center rounded-2xl border border-border bg-accent/30 p-6 text-center">
                <img src={qrData!} alt="QR code Telegram" className="h-52 w-52 rounded-xl" />
                <div className="mt-3 flex items-center gap-2">
                  <Pill tone={qrSecondsLeft < 8 ? 'amber' : 'teal'}>
                    <Clock3 size={12} /> {qrSecondsLeft > 0 ? `Expira em ${qrSecondsLeft}s` : 'Renovando…'}
                  </Pill>
                </div>
                <p className="mt-3 max-w-sm text-sm leading-6 text-foreground">
                  Abra o Telegram no celular, vá em <strong>Configurações → Dispositivos</strong> e escaneie o código. O QR é renovado automaticamente.
                </p>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-border bg-accent/30 p-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-foreground">
                  <QrCode size={26} />
                </div>
                <h3 className="sw-display mt-4 text-lg font-bold text-foreground">Nenhuma autorização em andamento</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Clique em "Autorizar com QR code" para gerar um código. Ele é atualizado automaticamente em tempo real.
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[['1', 'Solicite', 'Gere uma autorização segura'], ['2', 'Escaneie', 'Use Dispositivos no Telegram'], ['3', 'Escolha', 'Ative os grupos certos']].map(([n, t, b]) => (
                <div key={n} className="flex gap-3">
                  <div className="sw-mono grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#fee8da] text-[11px] font-bold text-[#c43e12]">{n}</div>
                  <div>
                    <div className="text-xs font-bold text-foreground">{t}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{b}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function BillingPage() {
  const plansQuery = useListBillingPlans({ query: { queryKey: getListBillingPlansQueryKey() } }); const statusQuery = useGetBillingStatus({ query: { queryKey: getGetBillingStatusQueryKey() } }); const plans = plansQuery.data ?? fallbackPlans; const status = statusQuery.data; const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly'); const [selected, setSelected] = useState<string | null>(null); const checkout = useCreatePixCheckout(); const qc = useQueryClient();
  const startCheckout = (planId: string) => { setSelected(planId); checkout.mutate({ data: { planId, cycle } }, { onSuccess: result => { qc.invalidateQueries({ queryKey: getGetBillingStatusQueryKey() }); toast({ title: result.status === 'unavailable' ? 'Checkout indisponível.' : 'Checkout Pix criado.', description: result.message ?? 'Acompanhe o status nesta página.' }); }, onError: () => toast({ title: 'Não foi possível iniciar o Pix.', variant: 'destructive' }) }); };
  const current: BillingStatus | undefined = status;
  const checkoutState = current?.checkout;
  return <><PageHeader eyebrow="Plano da operação" title="Plano e cobrança" description="Mais cobertura para encontrar os sinais que pagam a conta — sem surpresas no cartão." action={<div className="flex items-center rounded-lg border border-border bg-card p-1 text-xs font-bold"><button onClick={() => setCycle('monthly')} className={`rounded-md px-3 py-2 ${cycle === 'monthly' ? 'bg-[#fee8da] text-[#e8531a]' : 'text-muted-foreground'}`} data-testid="button-cycle-monthly">Mensal</button><button onClick={() => setCycle('annual')} className={`rounded-md px-3 py-2 ${cycle === 'annual' ? 'bg-[#fee8da] text-[#e8531a]' : 'text-muted-foreground'}`} data-testid="button-cycle-annual">Anual · 2 meses grátis</button></div>} />{current && <div className="mb-6 rounded-2xl border border-border bg-accent p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="text-[11px] font-bold uppercase tracking-[.13em] text-[#d44517]">Status atual</div><div className="mt-1 sw-display text-xl font-bold text-foreground">{current.plan.name} <span className="font-sans text-sm font-semibold text-muted-foreground">· {current.state === 'awaiting_payment' ? 'pagamento pendente' : current.state === 'paid' || current.state === 'active' ? 'ativo' : current.state}</span></div></div><Pill tone={current.state === 'awaiting_payment' ? 'amber' : 'teal'}>{current.state === 'awaiting_payment' ? 'Aguardando Pix' : 'Em dia'}</Pill></div></div>}{checkoutState && <div className="mb-6 rounded-2xl border border-[#fcc4a0] bg-[#fff4ee] p-5"><div className="flex items-center gap-2 font-bold text-[#c43e12]"><Clock3 size={17} /> Pagamento Pix {checkoutState.status === 'pending' ? 'pendente' : checkoutState.status}</div><p className="mt-1 text-sm leading-6 text-[#c43e12]">{checkoutState.message ?? 'O pagamento ainda não foi confirmado. Não feche esta página até finalizar.'}</p>{checkoutState.status === 'pending' && checkoutState.copyPaste && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input readOnly value={checkoutState.copyPaste} className="form-input flex-1 bg-card font-mono text-xs" data-testid="input-pix-copy-paste" /><Button variant="secondary" onClick={() => navigator.clipboard?.writeText(checkoutState.copyPaste ?? '')} data-testid="button-copy-pix"><Copy size={15} /> Copiar código</Button></div>}</div>}<div className="grid gap-4 lg:grid-cols-3">{plans.map((plan, idx) => <div key={plan.id} className={`sw-card relative flex flex-col rounded-2xl p-6 ${idx === 1 ? 'border-2 border-[#e8531a] shadow-[0_16px_34px_rgba(232,83,26,.12)]' : ''}`} data-testid={`card-plan-${plan.id}`}>{idx === 1 && <div className="absolute -top-3 left-5 rounded-full bg-[#e8531a] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-foreground">Mais escolhido</div>}<div className="text-[11px] font-bold uppercase tracking-[.15em] text-[#d44517]">{plan.name}</div><h2 className="sw-display mt-2 text-2xl font-bold text-foreground">{plan.description}</h2><div className="mt-5"><span className="sw-display text-4xl font-bold tracking-[-.06em] text-foreground">{money(cycle === 'monthly' ? plan.monthlyPriceCents : Math.round(plan.annualPriceCents / 12))}</span><span className="text-xs text-muted-foreground"> / mês</span></div><div className="mt-5 space-y-3 border-t border-border pt-5 text-sm text-muted-foreground">{(plan.features ?? []).map(feature => <div key={feature} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#e8531a]" />{feature}</div>)}</div><Button onClick={() => startCheckout(plan.id)} disabled={checkout.isPending || plan.id === current?.plan.id} variant={idx === 1 ? 'primary' : 'secondary'} className="mt-7 w-full" data-testid={`button-select-plan-${plan.id}`}>{plan.id === current?.plan.id ? 'Plano atual' : selected === plan.id && checkout.isPending ? 'Gerando Pix…' : 'Escolher plano'}</Button></div>)}</div><div className="mt-6 text-center text-xs text-muted-foreground">Pagamento processado por Mercado Pago. O plano só muda após confirmação do webhook.</div></>;
}

type SessionInfo = { id: string; lastActiveAt: string; createdAt: string; ip: string | null; city: string | null; country: string | null; browser: string | null; deviceType: 'mobile' | 'desktop' };

function SettingsPage() {
  const [tab, setTab] = useState<'preferences' | 'profile' | 'devices' | 'support'>('preferences');

  // ── Preferences ──────────────────────────────────────────────────────────
  const query = useGetPreferences({ query: { queryKey: getGetPreferencesQueryKey() } });
  const initial: UserPreference = query.data ?? { language: 'pt-BR', theme: 'light', timezone: 'America/Sao_Paulo', dateFormat: 'dd/MM/yyyy', timeFormat: '24h', inAppNotifications: true };
  const [form, setForm] = useState<UserPreference>(initial);
  const [dirty, setDirty] = useState(false);
  const update = useUpdatePreferences();
  const qc = useQueryClient();
  const set = <K extends keyof UserPreference>(key: K, value: UserPreference[K]) => { setForm(prev => ({ ...prev, [key]: value })); setDirty(true); };
  const save = () => update.mutate({ data: form }, { onSuccess: result => { setForm(result); setDirty(false); qc.invalidateQueries({ queryKey: getGetPreferencesQueryKey() }); toast({ title: 'Preferências salvas.' }); }, onError: () => toast({ title: 'Não foi possível salvar preferências.', variant: 'destructive' }) });

  // ── Profile ───────────────────────────────────────────────────────────────
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newFirstName, setNewFirstName] = useState(user?.firstName ?? '');
  const [newLastName, setNewLastName] = useState(user?.lastName ?? '');
  const [savingName, setSavingName] = useState(false);

  async function handlePhotoUpload(file: File) {
    setUploading(true);
    try {
      await user?.setProfileImage({ file });
      await user?.reload();
      toast({ title: 'Foto de perfil atualizada.' });
    } catch {
      toast({ title: 'Não foi possível atualizar a foto.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  async function saveName() {
    if (!newFirstName.trim()) return;
    setSavingName(true);
    try {
      const resp = await fetch(`${basePath}/api/profile/name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ firstName: newFirstName.trim(), lastName: newLastName.trim() }),
      });
      if (!resp.ok) throw new Error();
      await user?.reload();
      setEditingName(false);
      toast({ title: 'Nome atualizado com sucesso.' });
    } catch {
      toast({ title: 'Não foi possível atualizar o nome.', variant: 'destructive' });
    } finally {
      setSavingName(false);
    }
  }

  // ── Devices ───────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'devices' || sessions !== null) return;
    setSessionsLoading(true);
    fetch(`${basePath}/api/profile/sessions`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() as Promise<SessionInfo[]> : [])
      .then(data => setSessions(data))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }, [tab, sessions]);

  // ── Support ───────────────────────────────────────────────────────────────
  const [reportCategory, setReportCategory] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSending, setReportSending] = useState(false);

  async function sendReport() {
    if (!reportDesc.trim() || !reportCategory) return;
    setReportSending(true);
    try {
      await fetch(`${basePath}/api/support/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ category: reportCategory, description: reportDesc }),
      });
      setReportDesc('');
      setReportCategory('');
      toast({ title: 'Relatório enviado.', description: 'Nossa equipe analisará em breve.' });
    } catch {
      toast({ title: 'Não foi possível enviar o relatório.', variant: 'destructive' });
    } finally {
      setReportSending(false);
    }
  }

  const TABS: { id: typeof tab; label: string; icon: typeof Settings2 }[] = [
    { id: 'preferences', label: 'Preferências', icon: Settings2 },
    { id: 'profile', label: 'Perfil', icon: UserCircle2 },
    { id: 'devices', label: 'Dispositivos', icon: Monitor },
    { id: 'support', label: 'Suporte', icon: Bug },
  ];

  return (
    <>
      <PageHeader eyebrow="Seu espaço de trabalho" title="Configurações" description="Controle de conta, segurança, privacidade e preferências da operação." />

      {/* Tab bar */}
      <div className="mb-7 flex gap-0 overflow-x-auto border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${tab === t.id ? 'border-[#e8531a] text-[#e8531a]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            data-testid={`tab-settings-${t.id}`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Preferências ─────────────────────────────────────────────── */}
      {tab === 'preferences' && (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <section className="sw-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fee8da] text-[#d44517]"><Globe2 size={19} /></div>
              <div><h2 className="sw-display text-xl font-bold text-foreground">Idioma e região</h2><p className="mt-1 text-xs text-muted-foreground">Como datas e rótulos aparecem na sua conta.</p></div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Idioma"><select value={form.language} onChange={e => set('language', e.target.value as UserPreference['language'])} className="form-input" data-testid="select-language"><option value="pt-BR">Português (Brasil)</option><option value="en">English</option></select></Field>
              <Field label="Fuso horário"><select value={form.timezone} onChange={e => set('timezone', e.target.value)} className="form-input" data-testid="select-timezone"><option value="America/Sao_Paulo">Brasília (GMT−3)</option><option value="America/Manaus">Manaus (GMT−4)</option><option value="America/Belem">Belém (GMT−3)</option></select></Field>
              <Field label="Formato de data"><select value={form.dateFormat} onChange={e => set('dateFormat', e.target.value)} className="form-input" data-testid="select-date-format"><option value="dd/MM/yyyy">12/08/2026</option><option value="MM/dd/yyyy">08/12/2026</option></select></Field>
              <Field label="Formato de hora"><select value={form.timeFormat} onChange={e => set('timeFormat', e.target.value)} className="form-input" data-testid="select-time-format"><option value="24h">24 horas · 14:30</option><option value="12h">12 horas · 2:30 PM</option></select></Field>
            </div>
            <div className="mt-9 flex items-center gap-3 border-t border-border pt-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fee8da] text-[#c43e12]"><Sparkles size={18} /></div>
              <div className="flex-1">
                <div className="text-sm font-bold text-foreground">Notificações no app</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {'Notification' in window && Notification.permission === 'denied'
                    ? 'Permissão bloqueada no navegador. Habilite nas configurações do site.'
                    : 'Mostre avisos quando uma regra encontrar um sinal.'}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={form.inAppNotifications}
                aria-label="Alternar notificações"
                data-testid="button-toggle-notifications"
                onClick={async () => {
                  const next = !form.inAppNotifications;
                  // Request browser permission when enabling for the first time
                  if (next && 'Notification' in window && Notification.permission === 'default') {
                    await Notification.requestPermission();
                  }
                  set('inAppNotifications', next);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${form.inAppNotifications ? 'bg-[#e8531a]' : 'bg-muted-foreground/30'}`}
              >
                {/* thumb — block (not absolute) so translate is self-contained */}
                <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${form.inAppNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={!dirty || update.isPending} data-testid="button-save-preferences">{update.isPending ? 'Salvando…' : 'Salvar alterações'}</Button>
            </div>
          </section>

          <aside className="space-y-5">
            <section className="sw-card rounded-2xl p-6">
              <div className="flex items-center gap-2 text-[#d44517]"><KeyRound size={17} /><h2 className="font-bold">Conta e segurança</h2></div>
              <div className="mt-5 divide-y divide-[#e8e5df] text-sm">
                <button className="flex w-full items-center justify-between py-3 text-left font-semibold text-muted-foreground hover:text-[#d44517]" data-testid="button-manage-account">Gerenciar conta <ArrowRight size={15} /></button>
                <button className="flex w-full items-center justify-between py-3 text-left font-semibold text-muted-foreground hover:text-[#d44517]" data-testid="button-change-password">Alterar senha <ArrowRight size={15} /></button>
                <button className="flex w-full items-center justify-between py-3 text-left font-semibold text-[#a75c51] hover:text-[#843f35]" data-testid="button-delete-account">Solicitar exclusão <ArrowRight size={15} /></button>
              </div>
            </section>
            <section className="rounded-2xl bg-[#0f0f0f] p-6 text-[#fce8da]">
              <div className="flex items-center gap-2 text-[#f4a078]"><ShieldCheck size={17} /><span className="text-xs font-bold uppercase tracking-[.14em]">Dados sob controle</span></div>
              <p className="mt-4 text-sm leading-6 text-[#c8c4be]">Você decide quais grupos entram no radar. A qualquer momento, desconecte sua sessão e remova o histórico.</p>
              <Link href="/privacy" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#f4a078] hover:text-white" data-testid="link-privacy-settings">Ler política de privacidade <ArrowRight size={14} /></Link>
            </section>
          </aside>
        </div>
      )}

      {/* ── Tab: Perfil ───────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          {/* Avatar */}
          <section className="sw-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fee8da] text-[#d44517]"><UserCircle2 size={19} /></div>
              <div><h2 className="sw-display text-xl font-bold text-foreground">Foto de perfil</h2><p className="mt-1 text-xs text-muted-foreground">Aparece no topo do painel e em notificações.</p></div>
            </div>
            <div className="mt-6 flex flex-col items-center gap-5">
              <div className="relative">
                {user?.imageUrl
                  ? <img src={user.imageUrl} alt="Avatar" className="h-24 w-24 rounded-full object-cover ring-4 ring-[#fde8d4]" />
                  : <div className="grid h-24 w-24 place-items-center rounded-full bg-[#e8531a] text-2xl font-extrabold text-foreground">{(user?.firstName?.[0] ?? user?.fullName?.[0] ?? '?').toUpperCase()}</div>
                }
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <RefreshCw size={18} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                data-testid="input-photo-upload"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
                data-testid="button-upload-photo"
              >
                <Upload size={15} /> {uploading ? 'Enviando…' : 'Alterar foto'}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">PNG, JPEG ou WebP · máx. 10 MB</p>
            </div>
          </section>

          {/* Name */}
          <section className="sw-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fee8da] text-[#d44517]"><Pencil size={17} /></div>
              <div><h2 className="sw-display text-xl font-bold text-foreground">Nome de exibição</h2><p className="mt-1 text-xs text-muted-foreground">Como você aparece no painel e nos alertas.</p></div>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">Nome atual</div>
                <div className="mt-1 text-sm font-bold text-foreground">{user?.fullName ?? user?.firstName ?? '—'}</div>
                <div className="mt-0.5 text-xs text-[#b0aba5]">{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
              {!editingName ? (
                <Button variant="secondary" onClick={() => { setNewFirstName(user?.firstName ?? ''); setNewLastName(user?.lastName ?? ''); setEditingName(true); }} className="w-full" data-testid="button-edit-name">
                  <Pencil size={15} /> Editar nome
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Primeiro nome">
                      <input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} className="form-input" placeholder="Ex: João" data-testid="input-first-name" />
                    </Field>
                    <Field label="Sobrenome">
                      <input value={newLastName} onChange={e => setNewLastName(e.target.value)} className="form-input" placeholder="Ex: Silva" data-testid="input-last-name" />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setEditingName(false)} className="flex-1" data-testid="button-cancel-name">Cancelar</Button>
                    <Button onClick={saveName} disabled={savingName || !newFirstName.trim()} className="flex-1" data-testid="button-save-name">
                      {savingName ? 'Salvando…' : 'Salvar nome'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ── Tab: Dispositivos ─────────────────────────────────────────────── */}
      {tab === 'devices' && (
        <section className="sw-card rounded-2xl p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fee8da] text-[#d44517]"><Monitor size={19} /></div>
            <div>
              <h2 className="sw-display text-xl font-bold text-foreground">Sessões ativas</h2>
              <p className="mt-1 text-xs text-muted-foreground">Dispositivos com acesso à sua conta agora. Revogue sessões suspeitas.</p>
            </div>
            <Button variant="secondary" onClick={() => setSessions(null)} className="ml-auto" data-testid="button-refresh-sessions">
              <RefreshCw size={15} className={sessionsLoading ? 'animate-spin' : ''} /> Atualizar
            </Button>
          </div>

          {sessionsLoading ? (
            <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : !sessions || sessions.length === 0 ? (
            <EmptyState icon={Monitor} title="Nenhuma sessão encontrada" body="Não foi possível carregar as sessões ativas neste momento." />
          ) : (
            <div className="space-y-3">
              {sessions.map((s, idx) => (
                <div key={s.id} className={`rounded-xl border p-4 ${idx === 0 ? 'border-[#f0c8b0] bg-[#f5fff9]' : 'border-border bg-[#f9fcfb]'}`}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#fee8da] text-[#d44517]">
                      {s.deviceType === 'mobile' ? <Smartphone size={16} /> : <Laptop size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{s.browser ?? (s.deviceType === 'mobile' ? 'Dispositivo móvel' : 'Navegador desktop')}</span>
                        {idx === 0 && <span className="rounded-full bg-[#fde8d4] px-2 py-0.5 text-[10px] font-bold text-[#d44517]">Sessão atual</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {s.ip && <span className="flex items-center gap-1"><MapPin size={10} /> {s.ip}</span>}
                        {s.city && <span>{s.city}{s.country ? `, ${s.country}` : ''}</span>}
                        <span>Último acesso: {formatDay(s.lastActiveAt)}</span>
                        <span>Criada em: {formatDay(s.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-[#fcc4a0] bg-[#fff4ee] p-4 text-sm">
            <div className="flex items-center gap-2 font-bold text-[#c43e12]"><ShieldCheck size={15} /> Sessões isoladas por conta</div>
            <p className="mt-1 leading-6 text-[#c43e12]">Cada sessão é criptografada com AES-256-GCM e vinculada exclusivamente à sua conta. Para revogar uma sessão, desconecte sua sessão na página de Conexão.</p>
          </div>
        </section>
      )}

      {/* ── Tab: Suporte ──────────────────────────────────────────────────── */}
      {tab === 'support' && (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <section className="sw-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffe5df] text-[#a84032]"><Bug size={17} /></div>
              <div><h2 className="sw-display text-xl font-bold text-foreground">Relatar um problema</h2><p className="mt-1 text-xs text-muted-foreground">Descreva o que aconteceu. Nossa equipe analisa todos os relatórios.</p></div>
            </div>
            <div className="mt-6 space-y-4">
              <Field label="Categoria">
                <select value={reportCategory} onChange={e => setReportCategory(e.target.value)} className="form-input" data-testid="select-report-category">
                  <option value="">Selecione uma categoria…</option>
                  <option value="bug">Bug ou comportamento inesperado</option>
                  <option value="performance">Lentidão ou instabilidade</option>
                  <option value="telegram">Problema com conexão Telegram</option>
                  <option value="alerts">Alertas não chegando</option>
                  <option value="billing">Cobrança ou plano</option>
                  <option value="other">Outro</option>
                </select>
              </Field>
              <Field label="Descrição detalhada">
                <textarea
                  value={reportDesc}
                  onChange={e => setReportDesc(e.target.value)}
                  rows={5}
                  placeholder="Descreva o problema com o máximo de detalhes. O que aconteceu? Quando? Em qual parte da plataforma?"
                  className="form-input resize-none"
                  data-testid="textarea-report-description"
                />
              </Field>
              <Button
                onClick={sendReport}
                disabled={reportSending || !reportDesc.trim() || !reportCategory}
                className="w-full"
                data-testid="button-send-report"
              >
                <Send size={15} /> {reportSending ? 'Enviando…' : 'Enviar relatório'}
              </Button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="sw-card rounded-2xl p-6">
              <div className="flex items-center gap-2 text-[#d44517]"><FileText size={17} /><h2 className="font-bold">Documentação</h2></div>
              <div className="mt-5 divide-y divide-[#e8e5df] text-sm">
                {[
                  { label: 'Política de privacidade', href: '/privacy' },
                  { label: 'Termos de uso', href: '/terms' },
                  { label: 'Como funciona o monitoramento', href: '/privacy' },
                  { label: 'Conformidade LGPD', href: '/privacy' },
                ].map(({ label, href }) => (
                  <Link key={label} href={href} className="flex items-center justify-between py-3 text-muted-foreground hover:text-[#d44517]">
                    {label} <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            </section>
            <section className="rounded-2xl bg-[#0f0f0f] p-5 text-[#fce8da]">
              <div className="text-xs font-bold uppercase tracking-[.14em] text-[#f4a078]">Tempo médio de resposta</div>
              <div className="mt-3 text-2xl font-bold text-white sw-display">48 horas</div>
              <p className="mt-2 text-sm leading-6 text-[#c8c4be]">Todos os relatórios são analisados pela equipe técnica e respondidos por e-mail.</p>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}

function OnboardingPage() {
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const TOTAL_STEPS = 3;

  async function saveName() {
    if (!firstName.trim()) { setNameError('Informe pelo menos o primeiro nome.'); return; }
    setSaving(true);
    setNameError('');
    try {
      const resp = await fetch(`${basePath}/api/profile/name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      await user?.reload();
      setStep(2);
    } catch (e) {
      setNameError(`Não foi possível salvar: ${e instanceof Error ? e.message : 'tente novamente.'}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sw-noise min-h-[100dvh] bg-background">
      <header className="flex items-center justify-between px-5 py-6 lg:px-12">
        <Logo />
        <Link href="/app" className="text-sm font-bold text-foreground hover:text-[#252525]" data-testid="link-exit-onboarding">Pular configuração</Link>
      </header>
      <main className="mx-auto max-w-4xl px-5 pb-16 pt-8 lg:pt-14">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
            <div key={n} className="flex flex-1 items-center gap-2">
              <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${step > n ? 'bg-[#e8531a] text-white' : step === n ? 'bg-[#e8531a] text-white' : 'bg-[#dcebe6] text-muted-foreground'}`}>
                {step > n ? <Check size={15} /> : n}
              </div>
              {n < TOTAL_STEPS && <div className={`h-0.5 flex-1 ${step > n ? 'bg-[#78736e]' : 'bg-[#dcebe6]'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="mx-auto mt-14 max-w-xl">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[.17em] text-[#d44517]">Configure sua conta · 01</div>
              <h1 className="sw-display mt-3 text-4xl font-bold tracking-[-.05em] text-foreground lg:text-5xl">Como quer ser chamado?</h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-foreground">Seu nome aparecerá no painel e nos alertas. Você pode alterar depois nas configurações.</p>
            </div>
            <div className="sw-card mt-9 rounded-2xl p-7 lg:p-10">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#252525]">Primeiro nome <span className="text-[#de765f]">*</span></label>
                  <input
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); setNameError(''); }}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    placeholder="Ex: João"
                    className="form-input w-full"
                    autoFocus
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#252525]">Sobrenome <span className="text-[#b0aba5] font-normal">(opcional)</span></label>
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    placeholder="Ex: Silva"
                    className="form-input w-full"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              {nameError && <p className="mt-3 text-xs font-medium text-[#de765f]">{nameError}</p>}
              <button
                onClick={saveName}
                disabled={saving || !firstName.trim()}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8531a] px-5 py-3 text-sm font-bold text-white hover:bg-[#d44517] disabled:opacity-50"
                data-testid="button-save-name"
              >
                {saving ? 'Salvando…' : <>Continuar <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto mt-14 max-w-2xl">
            <div className="text-center">
              <div className="text-[11px] font-bold uppercase tracking-[.17em] text-[#d44517]">Configure sua conta · 02</div>
              <h1 className="sw-display mt-3 text-4xl font-bold tracking-[-.05em] text-foreground lg:text-5xl">Conecte seu Telegram.</h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-foreground">Uma sessão pessoal permite que o radar acompanhe seus grupos. Você autoriza pelo próprio Telegram, sem compartilhar senha.</p>
            </div>
            <div className="sw-card mt-9 rounded-2xl p-7 lg:p-10">
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#fee8da] text-[#252525]">
                  <QrCode size={38} />
                </div>
                <p className="mt-5 text-sm leading-6 text-foreground">Você pode conectar agora na página de <strong>Conexão</strong> depois de entrar no app. O radar começa a funcionar assim que autorizar.</p>
                <button onClick={() => setStep(3)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e8531a] px-5 py-3 text-sm font-bold text-white hover:bg-[#d44517]" data-testid="button-onboarding-skip-telegram">
                  Entendido, entrar no app <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="sw-fade-up mx-auto mt-16 max-w-xl text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#fee8da] text-[#252525]">
              <CheckCircle2 size={31} />
            </div>
            <h1 className="sw-display mt-6 text-4xl font-bold tracking-[-.04em] text-foreground">Tudo pronto{firstName ? `, ${firstName}` : ''}.</h1>
            <p className="mt-4 text-base leading-7 text-foreground">Seu radar está configurado. Conecte o Telegram e crie regras para começar a receber sinais.</p>
            <Link href="/app/connection" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#e8531a] px-5 py-3 text-sm font-bold text-white hover:bg-[#d44517]" data-testid="link-finish-onboarding">
              Conectar Telegram <ArrowRight size={16} />
            </Link>
            <div className="mt-4">
              <Link href="/app" className="text-sm font-bold text-foreground hover:text-[#252525]" data-testid="link-skip-to-dashboard">
                Ir direto para o painel
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



function LegalPage({ privacy = false }: { privacy?: boolean }) {
  return <div className="min-h-[100dvh] bg-background text-foreground"><header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6"><Logo /><Link href="/" className="text-sm font-bold text-foreground" data-testid="link-legal-home">Voltar para início</Link></header><main className="mx-auto max-w-3xl px-5 pb-20 pt-10"><div className="text-[11px] font-bold uppercase tracking-[.17em] text-[#d44517]">ViaX: Trace · documento legal</div><h1 className="sw-display mt-3 text-5xl font-bold tracking-[-.05em] text-foreground">{privacy ? 'Política de privacidade' : 'Termos de uso'}</h1><p className="mt-4 text-sm text-muted-foreground">Última atualização: 12 de agosto de 2026</p><div className="prose prose-sm mt-12 max-w-none prose-headings:font-[var(--app-font-serif)] prose-headings:text-foreground prose-p:leading-7 prose-p:text-muted-foreground prose-li:text-muted-foreground"><h2>1. Escopo</h2><p>{privacy ? 'Esta política explica quais dados o ViaX: Trace trata para entregar alertas de oportunidades comerciais e como você pode controlar esse tratamento.' : 'Estes termos regulam o uso do ViaX: Trace, uma ferramenta para monitoramento configurável de grupos do Telegram e organização de alertas comerciais.'}</p><h2>2. Uso responsável</h2><p>Você é responsável por usar o serviço de acordo com as regras do Telegram, com a legislação aplicável e com as permissões necessárias para os grupos que escolher monitorar.</p><h2>3. Integrações e estados</h2><p>Integrações de terceiros podem estar indisponíveis, pendentes ou sujeitas a confirmação externa. O ViaX: Trace informa esses estados sem presumir que uma autorização ou pagamento foi concluído.</p><h2>4. Dados e controle</h2><p>{privacy ? 'Tratamos dados de conta, preferências, grupos selecionados e mensagens necessárias para encontrar correspondências às suas regras. Você pode desconectar a sessão, alterar preferências e solicitar exclusão.' : 'Você mantém controle sobre suas regras, grupos e sessão. Recursos e limites podem variar conforme o plano contratado.'}</p><h2>5. Contato</h2><p>Para dúvidas sobre estes documentos ou sobre sua conta, use o canal de suporte indicado dentro do produto.</p></div></main></div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== uid) {
        qc.clear();
      }
      prevUserIdRef.current = uid;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function SignInPage() {
  return (
    <div className="sw-noise flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <Link
        href="/forgot-password"
        className="text-sm text-[#6b6560] transition-colors hover:text-[#e8e5e0]"
        data-testid="link-forgot-password"
      >
        Esqueceu sua senha?
      </Link>
    </div>
  );
}

type ForgotStep = 'email' | 'code' | 'done';

function ForgotPasswordPage() {
  const { signIn, isLoaded } = useSignIn();
  const [step, setStep] = useState<ForgotStep>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      await signIn!.create({ strategy: 'reset_password_email_code', identifier: email });
      setStep('code');
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message ?? 'Não foi possível enviar o código. Verifique o email.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn!.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      } as Parameters<typeof signIn.attemptFirstFactor>[0]);
      if (result.status === 'complete') {
        setStep('done');
        setTimeout(() => setLocation('/sign-in'), 2500);
      } else {
        setError('Não foi possível confirmar. Tente novamente.');
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(clerkErr.errors?.[0]?.message ?? 'Código ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  const shell = (content: React.ReactNode) => (
    <div className="sw-noise flex min-h-[100dvh] items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-[440px] max-w-full overflow-hidden rounded-2xl bg-card shadow-xl">
        {/* header */}
        <div className="flex flex-col items-center gap-3 border-b border-border bg-card px-8 pt-8 pb-6">
          <Logo />
          {step !== 'done' && (
            <>
              <h1 className="sw-display text-xl font-bold text-foreground">
                {step === 'email' ? 'Redefinir senha' : 'Nova senha'}
              </h1>
              <p className="text-center text-sm text-muted-foreground">
                {step === 'email'
                  ? 'Digite seu email e enviaremos um código de verificação.'
                  : <>Enviamos um código para <span className="font-semibold text-foreground">{email}</span>. Insira-o abaixo junto com sua nova senha.</>}
              </p>
            </>
          )}
        </div>

        {/* body */}
        <div className="px-8 py-7">
          {/* ── Step 1: email ───────────────────────────── */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Email</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="form-input w-full"
                  data-testid="input-forgot-email"
                />
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-xl bg-[#e8531a] py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(232,83,26,.22)] transition hover:bg-[#d44517] disabled:opacity-50"
                data-testid="button-send-reset-code"
              >
                {loading ? 'Enviando…' : 'Enviar código'}
              </button>
              <Link
                href="/sign-in"
                className="block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                ← Voltar para o login
              </Link>
            </form>
          )}

          {/* ── Step 2: code + new password ─────────────── */}
          {step === 'code' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Código de verificação</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  autoFocus
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="000000"
                  className="form-input w-full tracking-[.3em]"
                  data-testid="input-reset-code"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Nova senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="form-input w-full pr-11"
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading || !code || !password}
                className="w-full rounded-xl bg-[#e8531a] py-3 text-sm font-bold text-white shadow-[0_6px_16px_rgba(232,83,26,.22)] transition hover:bg-[#d44517] disabled:opacity-50"
                data-testid="button-confirm-reset"
              >
                {loading ? 'Redefinindo…' : 'Redefinir senha'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setPassword(''); setError(''); }}
                className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                ← Reenviar código
              </button>
            </form>
          )}

          {/* ── Step 3: done ────────────────────────────── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#e8531a]/10">
                <CheckCircle2 size={28} className="text-[#e8531a]" />
              </div>
              <h2 className="sw-display text-xl font-bold text-foreground">Senha redefinida!</h2>
              <p className="text-sm text-muted-foreground">
                Sua senha foi alterada com sucesso. Redirecionando para o login…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return shell(null);
}

function SignUpPage() {
  return (
    <div className="sw-noise flex min-h-[100dvh] items-center justify-center bg-[#0f0f0f] px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in"><WouterRedirect to="/app" /></Show>
      <Show when="signed-out"><Landing /></Show>
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [location] = useLocation();
  const needsOnboarding = isLoaded && user && !user.firstName && !location.startsWith('/onboarding');
  return (
    <>
      <Show when="signed-in">
        {needsOnboarding ? <WouterRedirect to="/onboarding" /> : children}
      </Show>
      <Show when="signed-out"><WouterRedirect to="/sign-in" /></Show>
    </>
  );
}

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/app" component={() => <ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
        <Route path="/app/alerts" component={() => <ProtectedRoute><AppShell><AlertsPage /></AppShell></ProtectedRoute>} />
        <Route path="/app/rules" component={() => <ProtectedRoute><AppShell><RulesPage /></AppShell></ProtectedRoute>} />
        <Route path="/app/groups" component={() => <ProtectedRoute><AppShell><GroupsPage /></AppShell></ProtectedRoute>} />
        <Route path="/app/connection" component={() => <ProtectedRoute><AppShell><ConnectionPage /></AppShell></ProtectedRoute>} />
        <Route path="/app/billing" component={() => <ProtectedRoute><AppShell><BillingPage /></AppShell></ProtectedRoute>} />
        <Route path="/app/settings" component={() => <ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>} />
        <Route path="/terms" component={() => <LegalPage />} />
        <Route path="/privacy" component={() => <LegalPage privacy />} />
        <Route component={HomeRoute} />
      </Switch>
    </ErrorBoundary>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Bem-vindo de volta.', subtitle: 'Entre para ver os sinais que pedem sua atenção.' } },
        signUp: { start: { title: 'Crie seu radar.', subtitle: 'Configure em minutos. Ajuste quando seu contexto mudar.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;