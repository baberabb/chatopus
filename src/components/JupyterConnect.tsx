import { Server } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function JupyterConnect() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 px-2 py-1 text-sm rounded hover:bg-opacity-10 hover:bg-white transition-colors">
          <Server size={16} />
          <span>Connect Jupyter</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">Connect to Jupyter</h4>
          <p className="text-sm text-muted-foreground">
            Connect to a Jupyter server to enable notebook integration.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => {
                console.log("Connect to Jupyter server - placeholder");
                // TODO: Implement Jupyter server connection
              }}
              className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Connect
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
