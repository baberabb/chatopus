import React, { useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CustomParameterFormData, ParameterType } from "../../types";

interface Props {
  onAdd: (parameter: CustomParameterFormData) => void;
  onCancel: () => void;
}

const PARAMETER_TYPES: { value: ParameterType; label: string }[] = [
  { value: "string", label: "String" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
];

export function CustomParameterForm({ onAdd, onCancel }: Props) {
  const [formData, setFormData] = useState<CustomParameterFormData>({
    name: "",
    type: "string",
    label: "",
    default: "",
    description: "",
    validation: {},
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };

  const renderValidationFields = () => {
    switch (formData.type) {
      case "number":
        return (
          <>
            <div className="space-y-2">
              <Label>Min Value</Label>
              <Input
                type="number"
                value={formData.validation?.min ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    validation: {
                      ...formData.validation,
                      min: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Value</Label>
              <Input
                type="number"
                value={formData.validation?.max ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    validation: {
                      ...formData.validation,
                      max: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Step</Label>
              <Input
                type="number"
                value={formData.validation?.step ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    validation: {
                      ...formData.validation,
                      step: parseFloat(e.target.value),
                    },
                  })
                }
              />
            </div>
          </>
        );

      case "select":
        return (
          <div className="space-y-2">
            <Label>Options (comma-separated)</Label>
            <Input
              type="text"
              value={formData.validation?.options?.join(", ") ?? ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  validation: {
                    ...formData.validation,
                    options: e.target.value.split(",").map((s) => s.trim()),
                  },
                })
              }
              placeholder="option1, option2, option3"
            />
          </div>
        );

      default:
        return null;
    }
  };

  const renderDefaultValueField = () => {
    switch (formData.type) {
      case "number":
        return (
          <Input
            type="number"
            value={formData.default}
            onChange={(e) =>
              setFormData({
                ...formData,
                default: parseFloat(e.target.value),
              })
            }
          />
        );

      case "boolean":
        return (
          <Select
            value={formData.default.toString()}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                default: value === "true",
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select default value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        );

      case "select":
        return (
          <Input
            type="text"
            value={formData.default}
            onChange={(e) =>
              setFormData({
                ...formData,
                default: e.target.value,
              })
            }
            placeholder="Default option"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={formData.default}
            onChange={(e) =>
              setFormData({
                ...formData,
                default: e.target.value,
              })
            }
          />
        );
    }
  };

  return (
    <Card className="p-6">
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Parameter Name</Label>
            <Input
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value,
                })
              }
              placeholder="e.g., frequency_penalty"
            />
          </div>

          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              required
              value={formData.label}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  label: e.target.value,
                })
              }
              placeholder="e.g., Frequency Penalty"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  description: e.target.value,
                })
              }
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: ParameterType) =>
                setFormData({
                  ...formData,
                  type: value,
                  default: value === "boolean" ? false : "",
                  validation: {},
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parameter type" />
              </SelectTrigger>
              <SelectContent>
                {PARAMETER_TYPES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Default Value</Label>
            {renderDefaultValueField()}
          </div>

          {renderValidationFields()}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Add Parameter</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
