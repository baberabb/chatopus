import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PlusCircle,
  X,
  Type,
  Hash,
  List,
  ToggleLeft,
  Trash2,
} from "lucide-react";

type ArgType = "text" | "number" | "select" | "boolean";

interface Arg {
  name: string;
  type: ArgType;
  value: string | number | boolean;
  options?: string[];
}

interface PrefixTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

interface API {
  id: string;
  nick: string;
  args: Arg[];
  systemSetting: string;
  prefixTurns: PrefixTurn[];
}

const typeIcons = {
  text: Type,
  number: Hash,
  select: List,
  boolean: ToggleLeft,
};

const defaultAPIs: API[] = [
  {
    id: "gpt3.5",
    nick: "GPT-3.5",
    args: [
      {
        name: "model",
        type: "select",
        value: "gpt-3.5-turbo",
        options: ["gpt-3.5-turbo", "gpt-3.5-turbo-16k"],
      },
      { name: "max_tokens", type: "number", value: 100 },
      { name: "temperature", type: "number", value: 0.7 },
    ],
    systemSetting: "",
    prefixTurns: [],
  },
  {
    id: "gpt4",
    nick: "GPT-4",
    args: [
      {
        name: "model",
        type: "select",
        value: "gpt-4",
        options: ["gpt-4", "gpt-4-32k"],
      },
      { name: "max_tokens", type: "number", value: 200 },
      { name: "temperature", type: "number", value: 0.5 },
    ],
    systemSetting: "",
    prefixTurns: [],
  },
];

const APICustomizer: React.FC = () => {
  const [apis, setAPIs] = useState<API[]>([...defaultAPIs]);
  const [activeAPIId, setActiveAPIId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);

  useEffect(() => {
    if (activeAPIId === null && apis.length > 0) {
      setActiveAPIId(apis[0].id);
    }
  }, [apis, activeAPIId]);

  const addAPI = () => {
    const newId = `custom-${Date.now()}`;
    const newAPI: API = {
      id: newId,
      nick: "New Custom API",
      args: [],
      systemSetting: "",
      prefixTurns: [],
    };
    setAPIs([...apis, newAPI]);
    setActiveAPIId(newId);
  };

  const updateAPI = (field: keyof API, value: any) => {
    setAPIs((prevAPIs) =>
      prevAPIs.map((api) =>
        api.id === activeAPIId ? { ...api, [field]: value } : api,
      ),
    );
  };

  const deleteAPI = (id: string) => {
    setAPIs((prevAPIs) => prevAPIs.filter((api) => api.id !== id));
    if (activeAPIId === id) {
      setActiveAPIId(apis.length > 1 ? apis[0].id : null);
    }
  };

  const addArg = () => {
    updateAPI("args", [
      ...(apis.find((a) => a.id === activeAPIId)?.args || []),
      { name: "", type: "text", value: "" },
    ]);
  };

  const updateArg = (index: number, field: keyof Arg, value: any) => {
    const apiToUpdate = apis.find((a) => a.id === activeAPIId);
    if (apiToUpdate && apiToUpdate.args) {
      const newArgs = [...apiToUpdate.args];
      newArgs[index] = { ...newArgs[index], [field]: value };
      updateAPI("args", newArgs);
    }
  };

  const removeArg = (index: number) => {
    const apiToUpdate = apis.find((a) => a.id === activeAPIId);
    if (apiToUpdate && apiToUpdate.args) {
      updateAPI(
        "args",
        apiToUpdate.args.filter((_, i) => i !== index),
      );
    }
  };

  const addPrefixTurn = () => {
    updateAPI("prefixTurns", [
      ...(apis.find((a) => a.id === activeAPIId)?.prefixTurns || []),
      { role: "user", content: "" },
    ]);
  };

  const updatePrefixTurn = (
    index: number,
    field: keyof PrefixTurn,
    value: string,
  ) => {
    const apiToUpdate = apis.find((a) => a.id === activeAPIId);
    if (apiToUpdate && apiToUpdate.prefixTurns) {
      const newPrefixTurns = [...apiToUpdate.prefixTurns];
      newPrefixTurns[index] = { ...newPrefixTurns[index], [field]: value };
      updateAPI("prefixTurns", newPrefixTurns);
    }
  };

  const removePrefixTurn = (index: number) => {
    const apiToUpdate = apis.find((a) => a.id === activeAPIId);
    if (apiToUpdate && apiToUpdate.prefixTurns) {
      updateAPI(
        "prefixTurns",
        apiToUpdate.prefixTurns.filter((_, i) => i !== index),
      );
    }
  };

  const handleSubmit = () => {
    console.log(apis);
  };

  const activeAPI = apis.find((a) => a.id === activeAPIId);

  if (!activeAPI) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="w-[800px]">
      <CardHeader>
        <CardTitle>API Customizer</CardTitle>
        <CardDescription>Customize your API settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Label>Saved APIs</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {apis.map((api) => (
              <Button
                key={api.id}
                variant={api.id === activeAPIId ? "default" : "outline"}
                onClick={() => setActiveAPIId(api.id)}
                className="flex items-center"
              >
                {api.nick}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAPI(api.id);
                  }}
                  className="ml-2 h-4 w-4 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Button>
            ))}
            <Button onClick={addAPI} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" /> New API
            </Button>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <Label htmlFor={`api-nick-${activeAPI.id}`}>API Nickname</Label>
            <Input
              id={`api-nick-${activeAPI.id}`}
              value={activeAPI.nick}
              onChange={(e) => updateAPI("nick", e.target.value)}
              placeholder="Give your API a nickname"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Arguments</Label>
              <Button variant="outline" onClick={() => setEditMode(!editMode)}>
                {editMode ? "Done" : "Edit"}
              </Button>
            </div>
            {activeAPI.args?.map((arg, index) => (
              <div key={index} className="flex items-center space-x-2 mt-2">
                {editMode && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 flex items-center justify-center"
                        title="Change argument type"
                      >
                        {React.createElement(typeIcons[arg.type], {
                          className: "w-8 h-8",
                          strokeWidth: 1.5,
                        })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[120px] p-0">
                      <div className="p-1">
                        {(
                          Object.entries(typeIcons) as [
                            ArgType,
                            React.ElementType,
                          ][]
                        ).map(([type, Icon]) => (
                          <div
                            key={type}
                            className="cursor-pointer p-2 hover:bg-gray-100 capitalize flex items-center"
                            onClick={() => updateArg(index, "type", type)}
                          >
                            <Icon size={16} className="mr-2" />
                            {type}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                <Input
                  placeholder="Argument name"
                  value={arg.name}
                  onChange={(e) => updateArg(index, "name", e.target.value)}
                  className="flex-grow"
                />
                {arg.type === "select" ? (
                  <Select
                    value={arg.value as string}
                    onValueChange={(value) => updateArg(index, "value", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      {arg.options?.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : arg.type === "boolean" ? (
                  <Switch
                    checked={arg.value as boolean}
                    onCheckedChange={(checked) =>
                      updateArg(index, "value", checked)
                    }
                  />
                ) : (
                  <Input
                    type={arg.type}
                    value={arg.value as string | number}
                    onChange={(e) => updateArg(index, "value", e.target.value)}
                    className="w-[180px]"
                  />
                )}
                {editMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeArg(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {editMode && (
              <Button onClick={addArg} className="mt-2">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Argument
              </Button>
            )}
          </div>
          <div>
            <Label htmlFor={`system-setting-${activeAPI.id}`}>
              System Setting
            </Label>
            <Textarea
              id={`system-setting-${activeAPI.id}`}
              value={activeAPI.systemSetting}
              onChange={(e) => updateAPI("systemSetting", e.target.value)}
              placeholder="Enter system setting here"
              rows={4}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Prefix Turns</Label>
              <Button onClick={addPrefixTurn} variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Prefix Turn
              </Button>
            </div>
            {activeAPI.prefixTurns?.map((turn, index) => (
              <div key={index} className="flex items-start space-x-2 mt-4">
                <Select
                  value={turn.role}
                  onValueChange={(value: "user" | "assistant" | "system") =>
                    updatePrefixTurn(index, "role", value)
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={turn.content}
                  onChange={(e) =>
                    updatePrefixTurn(index, "content", e.target.value)
                  }
                  placeholder="Enter turn content"
                  className="flex-grow"
                  rows={2}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePrefixTurn(index)}
                  className="mt-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit} className="w-full">
          Save API Configurations
        </Button>
      </CardFooter>
    </Card>
  );
};

export default APICustomizer;
