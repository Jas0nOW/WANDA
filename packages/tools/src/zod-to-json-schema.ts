// =============================================================================
// Wanda — Minimal Zod-to-JSON-Schema converter
// =============================================================================
// Lightweight converter for tool parameter schemas.
// Handles the subset of zod types we actually use.

import { type ZodTypeAny, ZodString, ZodNumber, ZodBoolean, ZodObject, ZodOptional, ZodDefault, ZodEnum, ZodArray } from 'zod';

export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
    return toJsonSchema(schema);
}

function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
    // Unwrap defaults
    if (schema instanceof ZodDefault) {
        const inner = toJsonSchema(schema._def.innerType);
        inner.default = schema._def.defaultValue();
        return inner;
    }

    // Unwrap optionals
    if (schema instanceof ZodOptional) {
        return toJsonSchema(schema._def.innerType);
    }

    if (schema instanceof ZodString) {
        return { type: 'string' };
    }

    if (schema instanceof ZodNumber) {
        return { type: 'number' };
    }

    if (schema instanceof ZodBoolean) {
        return { type: 'boolean' };
    }

    if (schema instanceof ZodEnum) {
        return { type: 'string', enum: schema._def.values };
    }

    if (schema instanceof ZodArray) {
        return {
            type: 'array',
            items: toJsonSchema(schema._def.type),
        };
    }

    if (schema instanceof ZodObject) {
        const shape = schema._def.shape();
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
            const zodValue = value as ZodTypeAny;
            properties[key] = toJsonSchema(zodValue);
            // Mark as required unless it's optional or has a default
            if (!(zodValue instanceof ZodOptional) && !(zodValue instanceof ZodDefault)) {
                required.push(key);
            }
        }

        const result: Record<string, unknown> = {
            type: 'object',
            properties,
        };
        if (required.length > 0) {
            result.required = required;
        }
        return result;
    }

    // Fallback
    return {};
}
