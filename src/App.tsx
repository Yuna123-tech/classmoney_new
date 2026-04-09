import { useState, useEffect } from "react";
import { 
  Gem, 
  TrendingUp, 
  Gavel, 
  Settings, 
  LogIn, 
  User, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  Minus,
  RefreshCw,
  Award,
  Users,
  ShieldCheck,
  Bell
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "./lib/socket";

type Role = "student" | "teacher";
type Tab = "dashboard" | "stocks" | "auction" | "admin" | "my-page";

interface Student {
  name: string;
  balance: number;
  avatarUrl: string;
  certificates: string[];
  allowance: number;
  password?: string;
}

interface Stock {
  id: string;
  name: string;
  price: number;
  change: number;
}

interface Auction {
  id: string;
  name: string;
  startPrice: number;
  currentBid: number;
  highestBidder: string | null;
  endTime: number;
}

function StudentCard({ student, currencyName }: { student: Student; currencyName: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ 
        scale: 1.15, 
        rotateY: 15, 
        rotateX: -10,
        z: 100,
        boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.2)"
      }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="bg-white p-6 rounded-[2rem] shadow-xl border border-blue-50 relative overflow-hidden group perspective-1000 preserve-3d cursor-pointer"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-150" />
      
      <div className="flex flex-col items-center text-center preserve-3d">
        <motion.div 
          whileHover={{ translateZ: 50 }}
          className="relative mb-4"
        >
          <div className="w-24 h-24 rounded-full bg-blue-50 border-4 border-white shadow-xl overflow-hidden">
            <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          {student.certificates.length > 0 && (
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -bottom-1 -right-1 bg-yellow-400 text-white p-1.5 rounded-full shadow-lg border-2 border-white"
            >
              <ShieldCheck size={16} />
            </motion.div>
          )}
        </motion.div>
        
        <h3 className="text-xl font-black mb-1 text-gray-800 group-hover:text-blue-600 transition-colors">{student.name}</h3>
        <div className="flex items-center gap-1 text-blue-500 font-mono font-bold text-lg">
          <Gem size={18} />
          {student.balance.toLocaleString()}
        </div>
        
        <div className="mt-4 flex flex-wrap justify-center gap-1">
          {student.certificates.map((cert, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider border border-blue-100">
              {cert}
            </span>
          ))}
        </div>
        
        {student.allowance > 0 && (
          <div className="mt-2 text-[10px] text-blue-300 font-bold uppercase tracking-tighter">
            Weekly Bonus: +{student.allowance} {currencyName}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role>("student");
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [currencyName, setCurrencyName] = useState("보석");
  const [myProfile, setMyProfile] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [currentNews, setCurrentNews] = useState("오늘의 경제 소식: 시장이 평온합니다. ☕");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    fetchSettings();
    fetchStudents(); // Initial fetch for student names
    
    socket.on("stocks:update", (updatedStocks: Stock[]) => {
      setStocks(updatedStocks);
    });

    socket.on("news:update", (news: string) => {
      setCurrentNews(news);
    });

    socket.on("auction:start", (newAuction: Auction) => {
      setAuction(newAuction);
    });

    socket.on("auction:update", (updatedAuction: Auction) => {
      setAuction(updatedAuction);
    });

    socket.on("notification", (data: { message: string }) => {
      setNotifications(prev => [data.message, ...prev].slice(0, 5));
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsLoggedIn(true);
        setRole("teacher");
        fetchStudents();
      }
    };
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      socket.off("stocks:update");
      socket.off("auction:start");
      socket.off("auction:update");
      socket.off("notification");
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setCurrencyName(data.currencyName);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        // For demo, if student role, pick the first one as "me"
        if (role === "student" && data.length > 0) {
          setMyProfile(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const res = await fetch("/api/auth/url");
    const { url } = await res.json();
    window.open(url, "google_auth", "width=600,height=700");
  };

  const handleBid = (amount: number) => {
    if (myProfile && amount > myProfile.balance) return alert("잔액이 부족합니다!");
    socket.emit("auction:bid", { amount, bidder: myProfile?.name || "학생" });
  };

  const handleBulkReward = async (amount: number, reason: string) => {
    await fetch("/api/admin/bulk-reward", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, reason })
    });
  };

  const handleStudentLogin = () => {
    const student = students.find(s => s.name === loginName && s.password === loginPassword);
    if (student) {
      setMyProfile(student);
      setIsLoggedIn(true);
      setRole("student");
      setShowLoginModal(false);
    } else {
      alert("이름 또는 비밀번호가 틀렸습니다!");
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F9FF] text-[#1E293B] font-sans selection:bg-[#3B82F6] selection:text-white">
      {/* Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {notifications.map((note, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white/90 backdrop-blur-md border border-blue-100 p-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shrink-0">
                <Bell size={16} />
              </div>
              <p className="text-sm font-bold text-blue-900">{note}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-blue-900/40 backdrop-blur-sm"
              onClick={() => setShowLoginModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-10 shadow-2xl relative z-10 w-full max-w-md border-4 border-blue-100"
            >
              <h2 className="text-3xl font-black mb-6 text-blue-600 tracking-tighter text-center">학생 로그인</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">이름</label>
                  <select 
                    value={loginName} 
                    onChange={(e) => setLoginName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-400 outline-none transition-all"
                  >
                    <option value="">이름을 선택하세요</option>
                    {students.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">비밀번호</label>
                  <input 
                    type="password" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full bg-gray-50 border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-400 outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={handleStudentLogin}
                  className="w-full bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-600 transition-all active:scale-95"
                >
                  입장하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-blue-50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200"
            >
              <Gem size={28} />
            </motion.div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none text-blue-600">우리반 {currencyName}</h1>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.2em] mt-1">Class Economy System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {!isLoggedIn ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all"
                >
                  학생 로그인
                </button>
                <button 
                  onClick={handleLogin}
                  className="bg-white border-2 border-blue-100 text-blue-600 px-6 py-3 rounded-xl font-black text-sm hover:bg-blue-50 transition-all"
                >
                  선생님 로그인
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-1 bg-blue-50 p-1 rounded-xl">
                  <button 
                    onClick={() => setRole("student")}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${role === "student" ? "bg-white text-blue-600 shadow-sm" : "text-blue-400 hover:text-blue-600"}`}
                  >
                    학생 모드
                  </button>
                  <button 
                    onClick={() => setRole("teacher")}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${role === "teacher" ? "bg-white text-blue-600 shadow-sm" : "text-blue-400 hover:text-blue-600"}`}
                  >
                    선생님 모드
                  </button>
                </div>
                <button 
                  onClick={() => { setIsLoggedIn(false); setMyProfile(null); }}
                  className="bg-red-50 text-red-500 px-4 py-2 rounded-xl font-black text-xs hover:bg-red-100 transition-all"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-blue-50">
        <div className="max-w-6xl mx-auto px-6 flex gap-10">
          {[
            { id: "dashboard", label: "현황판", icon: Users },
            { id: "stocks", label: "주식 시장", icon: TrendingUp },
            { id: "auction", label: "라이브 경매", icon: Gavel },
            { id: "my-page", label: "내 정보", icon: User, hide: role === "teacher" },
            { id: "admin", label: "관리 도구", icon: Settings, hide: role === "student" },
          ].filter(t => !t.hide).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 py-5 text-sm font-black border-b-4 transition-all relative ${
                activeTab === tab.id 
                  ? "border-blue-500 text-blue-600" 
                  : "border-transparent text-gray-400 hover:text-blue-400"
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter mb-2 text-blue-900">실시간 {currencyName} 랭킹</h2>
                  <p className="text-blue-400 font-medium">우리 반 친구들의 경제 활동 현황입니다.</p>
                </div>
                <button 
                  onClick={fetchStudents}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-blue-100 rounded-2xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition-all active:scale-95 shadow-sm"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  새로고침
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {students.map((student, i) => (
                  <div key={i}>
                    <StudentCard student={student} currencyName={currencyName} />
                  </div>
                ))}
                {students.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-4 border-dashed border-blue-100">
                    <Users size={64} className="mx-auto mb-4 text-blue-100" />
                    <p className="text-xl font-bold text-blue-200">학생 데이터를 불러오는 중입니다...</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "stocks" && (
            <motion.div 
              key="stocks"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              {/* News Ticker */}
              <div className="bg-blue-600 text-white p-4 rounded-2xl overflow-hidden relative flex items-center shadow-xl shadow-blue-100">
                <div className="flex items-center gap-3 px-4 border-r border-white/20 mr-4 shrink-0">
                  <Bell size={18} className="animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest">Breaking News</span>
                </div>
                <motion.p 
                  key={currentNews}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-bold text-sm"
                >
                  {currentNews}
                </motion.p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {stocks.map((stock) => (
                  <div key={stock.id} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-blue-50 flex flex-col justify-between hover:border-blue-200 transition-all">
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                          <TrendingUp size={24} />
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${stock.change >= 0 ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                          {stock.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          {Math.abs(stock.change)}%
                        </div>
                      </div>
                      <h3 className="text-2xl font-black mb-2 text-gray-800">{stock.name}</h3>
                      <div className="text-4xl font-mono font-bold tracking-tighter text-blue-600">
                        {stock.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-gray-300 uppercase">{currencyName}</span>
                      </div>
                    </div>
                    
                    <div className="mt-10 flex gap-3">
                      <button className="flex-1 bg-blue-500 text-white py-4 rounded-2xl font-black hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-100">매수</button>
                      <button className="flex-1 bg-white border-2 border-blue-50 text-blue-500 py-4 rounded-2xl font-black hover:bg-blue-50 transition-all active:scale-95">매도</button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "auction" && (
            <motion.div 
              key="auction"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-3xl mx-auto"
            >
              {auction ? (
                <div className="bg-white rounded-[3rem] shadow-2xl border border-blue-50 overflow-hidden">
                  <div className="bg-blue-600 p-12 text-white text-center relative">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
                      <Gavel size={300} className="absolute -top-20 -left-20 rotate-12" />
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter mb-4">{auction.name}</h2>
                    <p className="text-white/60 font-bold uppercase tracking-[0.3em] text-xs">Current Highest Bid</p>
                    <div className="text-7xl font-mono font-black mt-4 tracking-tighter">
                      {auction.currentBid.toLocaleString()} <span className="text-2xl font-bold opacity-50">{currencyName}</span>
                    </div>
                  </div>
                  <div className="p-12 space-y-10">
                    <div className="flex justify-between items-center p-6 bg-blue-50 rounded-3xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-blue-100">
                          <User size={24} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Highest Bidder</p>
                          <p className="text-xl font-black text-blue-900">{auction.highestBidder || "입찰자 없음"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Time Remaining</p>
                        <p className="text-2xl font-black text-red-500">00:45</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-6">
                      {[10, 50, 100].map(plus => (
                        <button 
                          key={plus}
                          onClick={() => handleBid(auction.currentBid + plus)}
                          className="py-6 border-2 border-blue-100 rounded-[2rem] font-black text-2xl text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-all active:scale-95"
                        >
                          +{plus}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      onClick={() => handleBid(auction.currentBid + 1)}
                      className="w-full bg-blue-500 text-white py-8 rounded-[2rem] font-black text-3xl shadow-2xl shadow-blue-200 hover:bg-blue-600 transition-all transform active:scale-95"
                    >
                      지금 입찰하기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-blue-100">
                  <Gavel size={80} className="mx-auto mb-6 text-blue-100" />
                  <h3 className="text-2xl font-black text-blue-300">현재 진행 중인 경매가 없습니다.</h3>
                  <p className="text-blue-200 mt-2 font-medium">선생님이 경매를 시작할 때까지 기다려 주세요!</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "my-page" && myProfile && (
            <motion.div 
              key="my-page"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <div className="md:col-span-1 space-y-8">
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-blue-50 text-center">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-blue-50 border-4 border-white shadow-xl overflow-hidden">
                    <img src={myProfile.avatarUrl} alt={myProfile.name} className="w-full h-full object-cover" />
                  </div>
                  <h2 className="text-3xl font-black mb-1 text-blue-900">{myProfile.name}</h2>
                  <p className="text-blue-300 font-bold uppercase tracking-widest text-xs">Student Profile</p>
                </div>
                
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-blue-50">
                  <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-blue-900">
                    <Award size={20} className="text-yellow-500" />
                    보유 자격증
                  </h3>
                  <div className="flex flex-col gap-2">
                    {myProfile.certificates.map((cert, i) => (
                      <div key={i} className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center gap-3">
                        <ShieldCheck className="text-blue-600" size={20} />
                        <span className="font-bold text-blue-700">{cert}</span>
                      </div>
                    ))}
                    {myProfile.certificates.length === 0 && (
                      <p className="text-blue-200 text-sm font-medium text-center py-4">보유한 자격증이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-8">
                <div className="bg-blue-600 p-10 rounded-[3.5rem] text-white shadow-2xl shadow-blue-200">
                  <p className="text-xs font-bold uppercase tracking-[0.4em] opacity-60 mb-2">Total Balance</p>
                  <div className="text-7xl font-mono font-black tracking-tighter mb-8">
                    {myProfile.balance.toLocaleString()} <span className="text-2xl opacity-40">{currencyName}</span>
                  </div>
                  <div className="flex gap-10 border-t border-white/10 pt-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Weekly Allowance</p>
                      <p className="text-2xl font-black">+{myProfile.allowance.toLocaleString()} {currencyName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Class Rank</p>
                      <p className="text-2xl font-black">#4 / 28</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-blue-50">
                  <h3 className="text-xl font-black mb-6 text-blue-900">최근 거래 내역</h3>
                  <div className="space-y-4">
                    {[
                      { type: "plus", amount: 50, desc: "수학 자격증 주간 수당", date: "2026-04-06" },
                      { type: "minus", amount: 120, desc: "간식 경매: 초코파이", date: "2026-04-05" },
                      { type: "plus", amount: 10, desc: "발표 보상", date: "2026-04-04" },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between items-center p-4 hover:bg-blue-50/50 rounded-2xl transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === "plus" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                            {item.type === "plus" ? <Plus size={20} /> : <Minus size={20} />}
                          </div>
                          <div>
                            <p className="font-bold text-blue-900">{item.desc}</p>
                            <p className="text-[10px] text-blue-300 font-bold uppercase">{item.date}</p>
                          </div>
                        </div>
                        <div className={`font-mono font-black text-lg ${item.type === "plus" ? "text-green-600" : "text-red-600"}`}>
                          {item.type === "plus" ? "+" : "-"}{item.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "admin" && role === "teacher" && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-blue-50">
                  <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-blue-900">
                    <Gavel className="text-blue-500" />
                    새 경매 시작
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Item Name</label>
                      <input type="text" placeholder="예: 초코파이 1박스" className="w-full px-6 py-4 rounded-2xl bg-blue-50 border-2 border-transparent focus:border-blue-400 focus:bg-white transition-all outline-none font-bold text-blue-900" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Starting Price</label>
                      <input type="number" placeholder="100" className="w-full px-6 py-4 rounded-2xl bg-blue-50 border-2 border-transparent focus:border-blue-400 focus:bg-white transition-all outline-none font-bold text-blue-900" />
                    </div>
                    <button 
                      onClick={() => socket.emit("admin:auction:start", { name: "간식 세트", startPrice: 100 })}
                      className="w-full bg-blue-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-600 transition-all active:scale-95"
                    >
                      경매 런칭하기
                    </button>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-blue-50">
                  <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-blue-900">
                    <Award className="text-yellow-500" />
                    일괄 보상 지급
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Reward Amount</label>
                      <input type="number" id="bulk-amount" placeholder="50" className="w-full px-6 py-4 rounded-2xl bg-blue-50 border-2 border-transparent focus:border-blue-400 focus:bg-white transition-all outline-none font-bold text-blue-900" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-blue-300 uppercase tracking-widest mb-2">Reason</label>
                      <input type="text" id="bulk-reason" placeholder="예: 전원 과제 제출 보너스" className="w-full px-6 py-4 rounded-2xl bg-blue-50 border-2 border-transparent focus:border-blue-400 focus:bg-white transition-all outline-none font-bold text-blue-900" />
                    </div>
                    <button 
                      onClick={() => {
                        const amt = (document.getElementById("bulk-amount") as HTMLInputElement).value;
                        const reason = (document.getElementById("bulk-reason") as HTMLInputElement).value;
                        handleBulkReward(parseInt(amt), reason);
                      }}
                      className="w-full bg-green-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-green-100 hover:bg-green-600 transition-all active:scale-95"
                    >
                      전체 학생에게 지급
                    </button>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-blue-50">
                  <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-blue-900">
                    <RefreshCw className="text-blue-500" />
                    주간 수당 일괄 처리
                  </h3>
                  <div className="p-8 bg-blue-50 rounded-[2rem] border border-blue-100 mb-6">
                    <p className="text-sm font-bold text-blue-800 mb-2">💡 안내사항</p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      자격증 보유자에게 설정된 주간 수당을 일괄 지급합니다. 
                      매주 월요일 아침에 한 번만 실행하는 것을 권장합니다.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleBulkReward(0, "주간 수당 지급")}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    <RefreshCw size={20} />
                    지금 수당 지급하기
                  </button>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-blue-50">
                <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-blue-900">
                  <ShieldCheck className="text-blue-600" />
                  자격증 및 수당 관리
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-blue-300 uppercase tracking-widest border-b border-blue-50">
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4">Certificates</th>
                        <th className="px-6 py-4">Weekly Allowance</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-50">
                      {students.map((s, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-blue-900">{s.name}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              {s.certificates.map((c, j) => <span key={j} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg">{c}</span>)}
                              <button className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center text-blue-400 hover:bg-blue-100"><Plus size={14} /></button>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-blue-600">+{s.allowance}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-xs font-bold text-blue-500 hover:underline">수정</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}


