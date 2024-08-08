import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import DiscordLikeChat from "@/components/Chatbox.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "./globals.css";
import {
  Book,
  Bot,
  Code2,
  LifeBuoy,
  Menu,
  MessageSquare,
  Moon,
  Settings2,
  Share,
  SquareUser,
  Sun,
} from "lucide-react";
import { Button } from "./components/ui/button";
import Settings from "./components/Settings";
import { useZustandTheme } from "@/store";
import Model from "@/components/ModelSettings.tsx";


interface SidebarProps {
  isOpen: boolean;
  onRouteChange: (route: string) => void;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onRouteChange, toggleSidebar }) => {
  const { themeType, theme, toggleTheme } = useZustandTheme();

  const routes = [
    { name: "Chat", icon: MessageSquare },
    { name: "Model", icon: Bot },
    { name: "API", icon: Code2 },
    { name: "Documentation", icon: Book },
    { name: "Settings", icon: Settings2 },
  ];

  return (
      <aside
          className={`fixed inset-y-0 left-0 z-20 flex h-full w-[53px] flex-col border-r transition-transform duration-300 ease-in-out ${
              isOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0`}
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        {/*this controls the hamburger styling*/}
        <div className="border-b p-2 dark:bg-[#222628]" style={{ borderColor: theme.border }}>
          <Button variant="outline" size="icon" aria-label="Toggle Sidebar" onClick={toggleSidebar}>
            <Menu className="size-5" style={{ color: theme.text }} />
          </Button>
        </div>
        <nav className="grid gap-1 p-2">
          {routes.map(({ name, icon: Icon }) => (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <Button
                      variant="ghost"
                      size="icon"
                      className={`rounded-lg ${name.toLowerCase() === "chat" ? "bg-muted" : ""}`}
                      aria-label={name}
                      onClick={() => onRouteChange(name)}
                  >
                    <Icon className="size-5" style={{ color: theme.text }} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={5}>
                  {name}
                </TooltipContent>
              </Tooltip>
          ))}
        </nav>
        <nav className="mt-auto grid gap-1 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  aria-label="Help"
              >
                <LifeBuoy className="size-5" style={{ color: theme.text }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Help
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  aria-label="Account"
              >
                <SquareUser className="size-5" style={{ color: theme.text }} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Account
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg"
                  aria-label="Toggle Theme"
                  onClick={toggleTheme}
              >
                {themeType === "light" ? (
                    <Moon className="size-5" style={{ color: theme.text }} />
                ) : (
                    <Sun className="size-5" style={{ color: theme.text }} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={5}>
              Toggle Theme
            </TooltipContent>
          </Tooltip>
        </nav>
      </aside>
  );
};

const Header: React.FC<{ title: string; toggleSidebar: () => void }> = ({
                                                                          title,
                                                                          toggleSidebar
                                                                        }) => {
  const { theme } = useZustandTheme();
  return (
      <header
          className="sticky top-0 z-10 flex items-center border-b px-4 dark:bg-[#222628]"
          style={{
            borderColor: theme.border,
            height: "53px",
            minHeight: "53px",
            maxHeight: "53px",
          }}
      >
        <div
            className="fixed top-0 left-0 z-20 h-[53px] w-[53px] border-r lg:hidden"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className="p-2 dark:bg-[#222628]">
            <Button
                variant="outline"
                size="icon"
                aria-label="Toggle Sidebar"
                onClick={toggleSidebar}
            >
              <Menu className="size-5" style={{ color: theme.text }} />
            </Button>
          </div>
        </div>
        <h1
            className="text-xl font-semibold truncate ml-[53px] lg:ml-0"
            style={{ color: theme.text }}
        >
          {title}
        </h1>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
          <Share className="size-3.5" style={{ color: theme.text }} />
          Share
        </Button>
      </header>
  );
};

const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("chat");
  const { theme } = useZustandTheme();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleRouteChange = (route: string) => {
    setCurrentView(route.toLowerCase());
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.text;
  }, [theme]);

  return (
      <div
          className="h-screen w-full"
          style={{ backgroundColor: theme.background, color: theme.text }}
      >
        <Sidebar isOpen={isSidebarOpen} onRouteChange={handleRouteChange} toggleSidebar={toggleSidebar} />
        <div className="flex flex-grow flex-col lg:pl-[53px]">
          <Header
              title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
              toggleSidebar={toggleSidebar}
          />
          <main className="flex-grow overflow-hidden">
            {currentView === "chat" && <DiscordLikeChat />}
            {currentView === "settings" && <Settings />}
            {currentView === "model" && <Model />}
          </main>
        </div>
      </div>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <TooltipProvider>
        <AppLayout />
      </TooltipProvider>
    </React.StrictMode>
);
// interface SidebarProps {
//   isOpen: boolean;
//   onRouteChange: (route: string) => void;
// }
// export const useZustandTheme = () => useThemeStore();

// const Sidebar: React.FC<SidebarProps> = ({ isOpen, onRouteChange }) => {
//   const { themeType, theme, toggleTheme } = useZustandTheme();
//
//   const routes = [
//     { name: "Chat", icon: MessageSquare },
//     { name: "Model", icon: Bot },
//     { name: "API", icon: Code2 },
//     { name: "Documentation", icon: Book },
//     { name: "Settings", icon: Settings2 },
//   ];
//
//   return (
//     <aside
//       className={`fixed inset-y-0 left-0 z-20 flex h-full w-[53px] flex-col border-r transition-transform duration-300 ease-in-out ${
//         isOpen ? "translate-x-0" : "-translate-x-full"
//       } lg:translate-x-0`}
//       style={{ backgroundColor: theme.surface, borderColor: theme.border }}
//     >
//       <div className="border-b p-2" style={{ borderColor: theme.border }}>
//         <Button variant="outline" size="icon" aria-label="Home">
//           <Triangle className="size-5" style={{ fill: theme.text }} />
//         </Button>
//       </div>
//       <nav className="grid gap-1 p-2">
//         {routes.map(({ name, icon: Icon }) => (
//           <Tooltip key={name}>
//             <TooltipTrigger asChild>
//               <Button
//                 variant="ghost"
//                 size="icon"
//                 className={`rounded-lg ${name.toLowerCase() === "chat" ? "bg-muted" : ""}`}
//                 aria-label={name}
//                 onClick={() => onRouteChange(name)}
//               >
//                 <Icon className="size-5" style={{ color: theme.text }} />
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               {name}
//             </TooltipContent>
//           </Tooltip>
//         ))}
//       </nav>
//       <nav className="mt-auto grid gap-1 p-2">
//         <Tooltip>
//           <TooltipTrigger asChild>
//             <Button
//               variant="ghost"
//               size="icon"
//               className="rounded-lg"
//               aria-label="Help"
//             >
//               <LifeBuoy className="size-5" style={{ color: theme.text }} />
//             </Button>
//           </TooltipTrigger>
//           <TooltipContent side="right" sideOffset={5}>
//             Help
//           </TooltipContent>
//         </Tooltip>
//         <Tooltip>
//           <TooltipTrigger asChild>
//             <Button
//               variant="ghost"
//               size="icon"
//               className="rounded-lg"
//               aria-label="Account"
//             >
//               <SquareUser className="size-5" style={{ color: theme.text }} />
//             </Button>
//           </TooltipTrigger>
//           <TooltipContent side="right" sideOffset={5}>
//             Account
//           </TooltipContent>
//         </Tooltip>
//         <Tooltip>
//           <TooltipTrigger asChild>
//             <Button
//               variant="ghost"
//               size="icon"
//               className="rounded-lg"
//               aria-label="Toggle Theme"
//               onClick={toggleTheme}
//             >
//               {themeType === "light" ? (
//                 <Moon className="size-5" style={{ color: theme.text }} />
//               ) : (
//                 <Sun className="size-5" style={{ color: theme.text }} />
//               )}
//             </Button>
//           </TooltipTrigger>
//           <TooltipContent side="right" sideOffset={5}>
//             Toggle Theme
//           </TooltipContent>
//         </Tooltip>
//       </nav>
//     </aside>
//   );
// };

// const ToggleButton: React.FC<{
//   isOpen: boolean;
//   setIsOpen: (isOpen: boolean) => void;
// }> = ({ isOpen, setIsOpen }) => {
//   const { theme } = useZustandTheme();
//   return (
//     <button
//       className="lg:hidden fixed top-4 left-4 z-20 p-2 rounded-md"
//       onClick={() => setIsOpen(!isOpen)}
//       style={{ backgroundColor: theme.surface }}
//     >
//       <Menu size={24} style={{ color: theme.text }} />
//     </button>
//   );
// };
//
// const Header: React.FC<{ title: string }> = ({ title }) => {
//   const { theme } = useZustandTheme();
//   return (
//     <header
//       className="sticky top-0 z-10 flex items-center gap-1 border-b px-4 dark:bg-[#222628] "
//       style={{
//         // backgroundColor: theme.surface,
//         borderColor: theme.border,
//         height: "53px", // Explicitly set height
//         minHeight: "53px", // Ensure minimum height
//         maxHeight: "53px", // Prevent growing larger
//       }}
//     >
//       <h1
//         className="text-xl font-semibold truncate"
//         style={{ color: theme.text }}
//       >
//         {title}
//       </h1>
//       <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
//         <Share className="size-3.5" style={{ color: theme.text }} />
//         Share
//       </Button>
//     </header>
//   );
// };
//
// const AppLayout: React.FC = () => {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [currentView, setCurrentView] = useState("chat");
//   const { theme } = useZustandTheme();
//
//   const handleRouteChange = (route: string) => {
//     setCurrentView(route.toLowerCase());
//     setIsSidebarOpen(false);
//   };
//
//   useEffect(() => {
//     document.body.style.backgroundColor = theme.background;
//     document.body.style.color = theme.text;
//   }, [theme]);
//
//   return (
//     <div
//       className="h-screen w-full"
//       style={{ backgroundColor: theme.background, color: theme.text }}
//     >
//       <Sidebar isOpen={isSidebarOpen} onRouteChange={handleRouteChange} />
//       <ToggleButton isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
//       <div className="flex flex-grow flex-col lg:pl-[53px]">
//         <Header
//           title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
//         />
//         <main className="flex-grow overflow-hidden">
//           {currentView === "chat" && <DiscordLikeChat />}
//           {currentView === "settings" && <Settings />}
//           {currentView === "model" && <Model />}
//         </main>
//       </div>
//     </div>
//   );
// };
//
// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//   <React.StrictMode>
//     <TooltipProvider>
//       <AppLayout />
//     </TooltipProvider>
//   </React.StrictMode>,
// );
// const Header: React.FC<{
//   title: string;
//   isSidebarOpen: boolean;
//   toggleSidebar: () => void;
// }> = ({ title, isSidebarOpen, toggleSidebar }) => {
//   const { theme } = useZustandTheme();
//   return (
//       <header
//           className="sticky top-0 z-10 flex items-center gap-1 border-b px-4 dark:bg-[#222628]"
//           style={{
//             borderColor: theme.border,
//             height: "53px",
//             minHeight: "53px",
//             maxHeight: "53px",
//             paddingLeft: isSidebarOpen ? "calc(53px + 1rem)" : "1rem", // Add padding when sidebar is open
//           }}
//       >
//         <Button
//             variant="ghost"
//             size="icon"
//             className="lg:hidden mr-2"
//             onClick={toggleSidebar}
//         >
//           <Menu size={24} style={{ color: theme.text }} />
//         </Button>
//         <h1
//             className="text-xl font-semibold truncate"
//             style={{ color: theme.text }}
//         >
//           {title}
//         </h1>
//         <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
//           <Share className="size-3.5" style={{ color: theme.text }} />
//           Share
//         </Button>
//       </header>
//   );
// };
//
// const AppLayout: React.FC = () => {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [currentView, setCurrentView] = useState("chat");
//   const { theme } = useZustandTheme();
//
//   const handleRouteChange = (route: string) => {
//     setCurrentView(route.toLowerCase());
//     setIsSidebarOpen(false);
//   };
//
//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen);
//   };
//
//   useEffect(() => {
//     document.body.style.backgroundColor = theme.background;
//     document.body.style.color = theme.text;
//   }, [theme]);
//
//   return (
//       <div
//           className="h-screen w-full"
//           style={{ backgroundColor: theme.background, color: theme.text }}
//       >
//         <Sidebar isOpen={isSidebarOpen} onRouteChange={handleRouteChange} />
//         <div className="flex flex-grow flex-col lg:pl-[53px]">
//           <Header
//               title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
//               isSidebarOpen={isSidebarOpen}
//               toggleSidebar={toggleSidebar}
//           />
//           <main className="flex-grow overflow-hidden">
//             {currentView === "chat" && <DiscordLikeChat />}
//             {currentView === "settings" && <Settings />}
//             {currentView === "model" && <Model />}
//           </main>
//         </div>
//       </div>
//   );
// };
//
// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//     <React.StrictMode>
//       <TooltipProvider>
//         <AppLayout />
//       </TooltipProvider>
//     </React.StrictMode>,
// );
// interface SidebarProps {
//   isOpen: boolean;
//   onRouteChange: (route: string) => void;
// }
//
// const Sidebar: React.FC<SidebarProps> = ({ isOpen, onRouteChange }) => {
//   const { themeType, theme, toggleTheme } = useZustandTheme();
//
//   const routes = [
//     { name: "Chat", icon: MessageSquare },
//     { name: "Model", icon: Bot },
//     { name: "API", icon: Code2 },
//     { name: "Documentation", icon: Book },
//     { name: "Settings", icon: Settings2 },
//   ];
//
//   return (
//       <aside
//           className={`fixed inset-y-0 left-0 z-20 flex h-full w-[200px] flex-col border-r transition-transform duration-300 ease-in-out ${
//               isOpen ? "translate-x-0" : "-translate-x-full"
//           }`}
//           style={{ backgroundColor: theme.surface, borderColor: theme.border }}
//       >
//         <nav className="grid gap-1 p-2 mt-[53px]"> {/* Added top margin to account for header height */}
//           {routes.map(({ name, icon: Icon }) => (
//               <Tooltip key={name}>
//                 <TooltipTrigger asChild>
//                   <Button
//                       variant="ghost"
//                       className={`w-full justify-start gap-2 ${name.toLowerCase() === "chat" ? "bg-muted" : ""}`}
//                       aria-label={name}
//                       onClick={() => onRouteChange(name)}
//                   >
//                     <Icon className="size-5" style={{ color: theme.text }} />
//                     <span>{name}</span>
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent side="right" sideOffset={5}>
//                   {name}
//                 </TooltipContent>
//               </Tooltip>
//           ))}
//         </nav>
//         <nav className="mt-auto grid gap-1 p-2">
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button
//                   variant="ghost"
//                   className="w-full justify-start gap-2"
//                   aria-label="Help"
//               >
//                 <LifeBuoy className="size-5" style={{ color: theme.text }} />
//                 <span>Help</span>
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               Help
//             </TooltipContent>
//           </Tooltip>
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button
//                   variant="ghost"
//                   className="w-full justify-start gap-2"
//                   aria-label="Account"
//               >
//                 <SquareUser className="size-5" style={{ color: theme.text }} />
//                 <span>Account</span>
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               Account
//             </TooltipContent>
//           </Tooltip>
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button
//                   variant="ghost"
//                   className="w-full justify-start gap-2"
//                   aria-label="Toggle Theme"
//                   onClick={toggleTheme}
//               >
//                 {themeType === "light" ? (
//                     <Moon className="size-5" style={{ color: theme.text }} />
//                 ) : (
//                     <Sun className="size-5" style={{ color: theme.text }} />
//                 )}
//                 <span>Toggle Theme</span>
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               Toggle Theme
//             </TooltipContent>
//           </Tooltip>
//         </nav>
//       </aside>
//   );
// };
//
// const Header: React.FC<{
//   title: string;
//   isSidebarOpen: boolean;
//   toggleSidebar: () => void;
// }> = ({ title, isSidebarOpen, toggleSidebar }) => {
//   const { theme } = useZustandTheme();
//   return (
//       <header
//           className="fixed top-0 left-0 right-0 z-30 flex items-center gap-1 border-b px-4 dark:bg-[#222628]"
//           style={{
//             borderColor: theme.border,
//             height: "53px",
//             backgroundColor: theme.surface,
//           }}
//       >
//         <Button
//             variant="ghost"
//             size="icon"
//             className="mr-2"
//             onClick={toggleSidebar}
//         >
//           <Menu size={24} style={{ color: theme.text }} />
//         </Button>
//         <h1
//             className="text-xl font-semibold truncate"
//             style={{ color: theme.text }}
//         >
//           {title}
//         </h1>
//         <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
//           <Share className="size-3.5" style={{ color: theme.text }} />
//           Share
//         </Button>
//       </header>
//   );
// };
//
// const AppLayout: React.FC = () => {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [currentView, setCurrentView] = useState("chat");
//   const { theme } = useZustandTheme();
//
//   const handleRouteChange = (route: string) => {
//     setCurrentView(route.toLowerCase());
//     setIsSidebarOpen(false);
//   };
//
//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen);
//   };
//
//   useEffect(() => {
//     document.body.style.backgroundColor = theme.background;
//     document.body.style.color = theme.text;
//   }, [theme]);
//
//   return (
//       <div
//           className="h-screen w-full"
//           style={{ backgroundColor: theme.background, color: theme.text }}
//       >
//         <Header
//             title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
//             isSidebarOpen={isSidebarOpen}
//             toggleSidebar={toggleSidebar}
//         />
//         <Sidebar isOpen={isSidebarOpen} onRouteChange={handleRouteChange} />
//         <div className="flex flex-grow flex-col pt-[53px]"> {/* Added top padding to account for fixed header */}
//           <main className="flex-grow overflow-hidden">
//             {currentView === "chat" && <DiscordLikeChat />}
//             {currentView === "settings" && <Settings />}
//             {currentView === "model" && <Model />}
//           </main>
//         </div>
//       </div>
//   );
// };
//
// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//     <React.StrictMode>
//       <TooltipProvider>
//         <AppLayout />
//       </TooltipProvider>
//     </React.StrictMode>,
// );

// interface SidebarProps {
//   isOpen: boolean;
//   onRouteChange: (route: string) => void;
// }
//
// const Sidebar: React.FC<SidebarProps> = ({ isOpen, onRouteChange }) => {
//   const { themeType, theme, toggleTheme } = useZustandTheme();
//
//   const routes = [
//     { name: "Chat", icon: MessageSquare },
//     { name: "Model", icon: Bot },
//     { name: "API", icon: Code2 },
//     { name: "Documentation", icon: Book },
//     { name: "Settings", icon: Settings2 },
//   ];
//
//   return (
//       <aside
//           className={`fixed inset-y-0 left-0 z-20 flex h-full w-[53px] flex-col border-r transition-transform duration-300 ease-in-out ${
//               isOpen ? "translate-x-0" : "-translate-x-full"
//           } lg:translate-x-0`}
//           style={{ backgroundColor: theme.surface, borderColor: theme.border }}
//       >
//         <nav className="grid gap-1 p-2">
//           {routes.map(({ name, icon: Icon }) => (
//               <Tooltip key={name}>
//                 <TooltipTrigger asChild>
//                   <Button
//                       variant="ghost"
//                       size="icon"
//                       className={`rounded-lg ${name.toLowerCase() === "chat" ? "bg-muted" : ""}`}
//                       aria-label={name}
//                       onClick={() => onRouteChange(name)}
//                   >
//                     <Icon className="size-5" style={{ color: theme.text }} />
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent side="right" sideOffset={5}>
//                   {name}
//                 </TooltipContent>
//               </Tooltip>
//           ))}
//         </nav>
//         <nav className="mt-auto grid gap-1 p-2">
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button
//                   variant="ghost"
//                   size="icon"
//                   className="rounded-lg"
//                   aria-label="Help"
//               >
//                 <LifeBuoy className="size-5" style={{ color: theme.text }} />
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               Help
//             </TooltipContent>
//           </Tooltip>
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button
//                   variant="ghost"
//                   size="icon"
//                   className="rounded-lg"
//                   aria-label="Account"
//               >
//                 <SquareUser className="size-5" style={{ color: theme.text }} />
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               Account
//             </TooltipContent>
//           </Tooltip>
//           <Tooltip>
//             <TooltipTrigger asChild>
//               <Button
//                   variant="ghost"
//                   size="icon"
//                   className="rounded-lg"
//                   aria-label="Toggle Theme"
//                   onClick={toggleTheme}
//               >
//                 {themeType === "light" ? (
//                     <Moon className="size-5" style={{ color: theme.text }} />
//                 ) : (
//                     <Sun className="size-5" style={{ color: theme.text }} />
//                 )}
//               </Button>
//             </TooltipTrigger>
//             <TooltipContent side="right" sideOffset={5}>
//               Toggle Theme
//             </TooltipContent>
//           </Tooltip>
//         </nav>
//       </aside>
//   );
// };
//
// const Header: React.FC<{
//   title: string;
//   isSidebarOpen: boolean;
//   toggleSidebar: () => void;
// }> = ({ title, isSidebarOpen, toggleSidebar }) => {
//   const { theme } = useZustandTheme();
//   return (
//       <header
//           className="sticky top-0 z-10 flex items-center gap-1 border-b px-4 dark:bg-[#222628]"
//           style={{
//             borderColor: theme.border,
//             height: "53px",
//             minHeight: "53px",
//             maxHeight: "53px",
//           }}
//       >
//         <Button
//             variant="ghost"
//             size="icon"
//             className="lg:hidden mr-2"
//             onClick={toggleSidebar}
//         >
//           <Menu size={24} style={{ color: theme.text }} />
//         </Button>
//         <h1
//             className="text-xl font-semibold truncate"
//             style={{ color: theme.text }}
//         >
//           {title}
//         </h1>
//         <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-sm">
//           <Share className="size-3.5" style={{ color: theme.text }} />
//           Share
//         </Button>
//       </header>
//   );
// };
//
// const AppLayout: React.FC = () => {
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
//   const [currentView, setCurrentView] = useState("chat");
//   const { theme } = useZustandTheme();
//
//   const handleRouteChange = (route: string) => {
//     setCurrentView(route.toLowerCase());
//     setIsSidebarOpen(false);
//   };
//
//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen);
//   };
//
//   useEffect(() => {
//     document.body.style.backgroundColor = theme.background;
//     document.body.style.color = theme.text;
//   }, [theme]);
//
//   return (
//       <div
//           className="h-screen w-full"
//           style={{ backgroundColor: theme.background, color: theme.text }}
//       >
//         <Sidebar isOpen={isSidebarOpen} onRouteChange={handleRouteChange} />
//         <div className="flex flex-grow flex-col lg:pl-[53px]">
//           <Header
//               title={currentView.charAt(0).toUpperCase() + currentView.slice(1)}
//               isSidebarOpen={isSidebarOpen}
//               toggleSidebar={toggleSidebar}
//           />
//           <main className="flex-grow overflow-hidden">
//             {currentView === "chat" && <DiscordLikeChat />}
//             {currentView === "settings" && <Settings />}
//             {currentView === "model" && <Model />}
//           </main>
//         </div>
//       </div>
//   );
// };
//
// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//     <React.StrictMode>
//       <TooltipProvider>
//         <AppLayout />
//       </TooltipProvider>
//     </React.StrictMode>,
// );