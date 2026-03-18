#!/usr/bin/env node

import { createProgram } from "./commands.js";

const program = createProgram();
program.parse();
