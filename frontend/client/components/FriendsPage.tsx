import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Users, Plus, Trash2, ExternalLink, User } from "lucide-react";
import { toast } from "sonner";

interface Friend {
  name: string;
  address: string;
}

interface FriendsPageProps {
  friends: Friend[];
  onAddFriend: (name: string, address: string) => void;
  onRemoveFriend: (address: string) => void;
  onViewFriend: (address: string) => void;
  userAddress?: string;
}

export function FriendsPage({ friends, onAddFriend, onRemoveFriend, onViewFriend, userAddress }: FriendsPageProps) {
  const [newFriendName, setNewFriendName] = useState("");
  const [newFriendAddress, setNewFriendAddress] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAdd = () => {
    const cleanAddress = newFriendAddress.trim();
    if (!newFriendName || cleanAddress.length < 40) {
      return toast.error("Please enter a valid name and Sui address.");
    }
    if (friends.some(f => f.address.toLowerCase() === cleanAddress.toLowerCase())) {
        return toast.error("This trainer is already in your watchlist!");
    }
    onAddFriend(newFriendName, cleanAddress);
    setNewFriendName("");
    setNewFriendAddress("");
    setShowAddForm(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 font-nunito animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-4xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-4">
          <Users className="w-10 h-10 text-blue-500" />
          Trainer Watchlist
        </h1>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-500 hover:bg-blue-400 text-white font-black py-4 px-8 rounded-2xl border-4 border-slate-900 shadow-[6px_6px_0px_#1e293b] uppercase tracking-widest transition-all hover:-translate-y-1 active:translate-y-0"
        >
          {showAddForm ? "Close Form" : "Add Trainer"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="bg-white border-4 border-slate-900 shadow-[8px_8px_0px_#1e293b] mb-12 p-6 rounded-3xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col md:flex-row gap-4 lg:gap-6 items-start md:items-end">
            <div className="flex-1 w-full text-left">
              <label className="text-xs font-black text-slate-500 mb-2 block uppercase tracking-wider">Trainer Name / Alias</label>
              <input
                type="text"
                className="w-full h-[52px] border-2 border-slate-300 shadow-[4px_4px_0px_#f1f5f9] rounded-xl px-4 font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={newFriendName}
                onChange={e => setNewFriendName(e.target.value)}
                placeholder="e.g. Ash Ketchum"
              />
            </div>
            <div className="flex-[2] w-full text-left">
              <label className="text-xs font-black text-slate-500 mb-2 block uppercase tracking-wider">Sui Wallet Address</label>
              <input
                type="text"
                className="w-full h-[52px] border-2 border-slate-300 shadow-[4px_4px_0px_#f1f5f9] rounded-xl px-4 font-mono font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                value={newFriendAddress}
                onChange={e => setNewFriendAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="w-full md:w-32 flex flex-col mt-2 md:mt-0">
              {/* Invisible label ensures vertical alignment matches the inputs on desktop */}
              <label className="hidden md:block text-xs font-black mb-2 uppercase tracking-wider opacity-0 pointer-events-none">Add</label>
              <Button
                onClick={handleAdd}
                className="w-full h-[52px] bg-emerald-500 hover:bg-emerald-400 text-white font-black px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] uppercase tracking-widest transition-all hover:-translate-y-1"
              >
                Add
              </Button>
            </div>
          </div>
        </Card>
      )}

      {friends.length === 0 ? (
        <Card className="bg-white/50 backdrop-blur-sm border-4 border-dashed border-slate-300 rounded-3xl p-16 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-2xl font-black text-slate-400 uppercase tracking-widest">No Friends Added Yet</h3>
            <p className="text-slate-400 font-bold mt-2">Add other trainers to peek into their PC boxes!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {friends.map((friend) => (
            <Card key={friend.address} className="bg-white border-4 border-slate-900 shadow-[8px_8px_0px_#1e293b] rounded-3xl overflow-hidden group hover:-translate-x-1 hover:-translate-y-1 transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center border-2 border-blue-200">
                        <User className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{friend.name}</h3>
                      <p className="text-xs font-mono font-bold text-slate-400 break-all">{friend.address.slice(0, 12)}...{friend.address.slice(-8)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button 
                    onClick={() => onViewFriend(friend.address)}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-black py-2 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_#1e293b] uppercase tracking-widest text-xs transition-all"
                  >
                    View PC
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => window.open(`https://testnet.suivision.xyz/account/${friend.address}`, "_blank")}
                    className="aspect-square bg-slate-50 hover:bg-slate-100 text-slate-700 p-2 rounded-xl border-2 border-slate-300"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => onRemoveFriend(friend.address)}
                    className="aspect-square bg-white hover:bg-red-50 text-red-500 p-2 rounded-xl border-2 border-red-200"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
