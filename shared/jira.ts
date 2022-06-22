/*
 * Copyright 2022 Google LLC
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as hm from 'typed-rest-client/HttpClient';
import { parse } from 'csv-parse/sync';

let hc: hm.HttpClient = new hm.HttpClient(null);
const batchSize = 90; // Size of the batch of JIRA issues we'll get at once (days between start and creation date).

function formatDate(d: Date): string {
    let month = `${d.getMonth()+1}`;
    if (d.getMonth()+1 < 10) {
        month = `0${d.getMonth()+1}`;
    }
    return `${d.getFullYear()}-${month}-${d.getDate()}`;
}

function parseJiraCsv(csv: string): any[] {
    let i = 0;
    // Since multiple component and/or label columns could exist, give them unique names so the parser can handle them.
    while (csv.indexOf("Component/s,") > -1) {
        csv = csv.replace("Component/s,", `Component${i},`);
        i++;
    }
    i = 0;
    while (csv.indexOf("Labels,") > -1) {
        csv = csv.replace("Labels,", `Label${i},`);
        i++;
    }
    return parse(csv, {
        columns: true,
        skip_empty_lines: true
    });
}

export async function getJiras() {
    let jiras: any[] = [];
    let curEnd = new Date();
    let curStart = new Date();
    curStart.setDate(curStart.getDate() - batchSize);
    while (true) {
        console.log(`Getting jiras between ${formatDate(curStart)} and ${formatDate(curEnd)}`);
        const issues = await hc.get(`https://issues.apache.org/jira/sr/jira.issueviews:searchrequest-csv-all-fields/temp/SearchRequest.json?jqlQuery=project+%3D+BEAM+AND+resolution+%3D+Unresolved+AND+created+%3E%3D+${formatDate(curStart)}+AND+created+%3C%3D+${formatDate(curEnd)}+ORDER+BY+priority+DESC%2C+updated+DESC`)
        const csv: string = (await issues.readBody()).trim();
        curEnd.setDate(curEnd.getDate() - batchSize - 1);
        curStart.setDate(curStart.getDate() - batchSize - 1);
        if (csv.length === 0) {
            break;
        }
        jiras = jiras.concat(parseJiraCsv(csv));
    }
    curStart.setDate(curStart.getDate() - (365*50));
    const issues = await hc.get(`https://issues.apache.org/jira/sr/jira.issueviews:searchrequest-csv-all-fields/temp/SearchRequest.json?jqlQuery=project+%3D+BEAM+AND+resolution+%3D+Unresolved+AND+created+%3E%3D+${formatDate(curStart)}+AND+created+%3C%3D+${formatDate(curEnd)}+ORDER+BY+priority+DESC%2C+updated+DESC`)
    const csv: string = (await issues.readBody()).trim();
    if (csv.length !== 0) {
        jiras = jiras.concat(parseJiraCsv(csv));
    }
    return jiras.reverse();
}