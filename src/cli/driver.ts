/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import { installInspectorController } from '../server/supplements/inspectorController';
import { DispatcherConnection } from '../dispatchers/dispatcher';
import { PlaywrightDispatcher } from '../dispatchers/playwrightDispatcher';
import { installBrowsersWithProgressBar } from '../install/installer';
import { Transport } from '../protocol/transport';
import { Playwright } from '../server/playwright';
import { gracefullyCloseAll } from '../server/processLauncher';
import { installHarTracer } from '../trace/harTracer';
import { installTracer } from '../trace/tracer';
import { BrowserName } from '../utils/browserPaths';

export function printApiJson() {
  console.log(JSON.stringify(require('../../api.json')));
}

export function printProtocol() {
  console.log(fs.readFileSync(path.join(__dirname, '..', '..', 'protocol.yml'), 'utf8'));
}

export function runServer() {
  installInspectorController();
  installTracer();
  installHarTracer();

  const dispatcherConnection = new DispatcherConnection();
  const transport = new Transport(process.stdout, process.stdin);
  transport.onmessage = message => dispatcherConnection.dispatch(JSON.parse(message));
  dispatcherConnection.onmessage = message => transport.send(JSON.stringify(message));
  transport.onclose = async () => {
    // Drop any messages during shutdown on the floor.
    dispatcherConnection.onmessage = () => {};
    // Force exit after 30 seconds.
    setTimeout(() => process.exit(0), 30000);
    // Meanwhile, try to gracefully close all browsers.
    await gracefullyCloseAll();
    process.exit(0);
  };

  const playwright = new Playwright(__dirname, require('../../browsers.json')['browsers']);
  new PlaywrightDispatcher(dispatcherConnection.rootDispatcher(), playwright);
}

export async function installBrowsers(browserNames?: BrowserName[]) {
  const browsersJsonDir = path.join(__dirname, '..', '..');
  await installBrowsersWithProgressBar(browsersJsonDir, browserNames);
}
