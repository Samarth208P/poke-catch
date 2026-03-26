
import { useCurrentAccount, useDisconnectWallet, ConnectModal } from "@mysten/dapp-kit";
import { useState } from "react";
import { Button } from "./ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "./ui/dropdown-menu";
import { ChevronDown, LogOut, Copy, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";

export function CustomWallet() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [showModal, setShowModal] = useState(false);

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account.address);
      toast.success("Address copied!");
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!account) {
    return (
      <ConnectModal
        trigger={
          <button className="poke-border poke-effect bg-white px-6 py-2 rounded-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
            <Wallet className="w-5 h-5" />
            Connect Wallet
          </button>
        }
        open={showModal}
        onOpenChange={setShowModal}
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="poke-border poke-effect bg-white px-4 py-2 rounded-xl font-black text-slate-800 flex items-center gap-2 transition-all">
          <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-[1px_1px_0px_#000]"></div>
          {formatAddress(account.address)}
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-64 p-2 bg-white poke-border border-4 border-slate-900 shadow-[8px_8px_0px_#1e293b] rounded-2xl mt-2 overflow-hidden"
      >
        <div className="px-3 py-4 bg-slate-50 rounded-xl border-2 border-slate-200 mb-2">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Wallet</p>
           <p className="text-sm font-bold text-slate-800 break-all">{formatAddress(account.address)}</p>
        </div>

        <DropdownMenuItem 
          onClick={copyAddress}
          className="flex items-center gap-3 p-3 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg transition-colors focus:bg-blue-50 focus:text-blue-700"
        >
          <Copy className="w-4 h-4" /> Copy Address
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => window.open(`https://testnet.suivision.xyz/account/${account.address}`, "_blank")}
          className="flex items-center gap-3 p-3 font-bold text-slate-700 hover:bg-blue-50 cursor-pointer rounded-lg transition-colors focus:bg-blue-50 focus:text-blue-700"
        >
          <ExternalLink className="w-4 h-4" /> View in Explorer
        </DropdownMenuItem>
        
        <DropdownMenuSeparator className="bg-slate-200 h-0.5 my-1" />
        
        <DropdownMenuItem 
          onClick={() => disconnect()}
          className="flex items-center gap-3 p-3 font-bold text-red-600 hover:bg-red-50 cursor-pointer rounded-lg transition-colors focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="w-4 h-4" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
