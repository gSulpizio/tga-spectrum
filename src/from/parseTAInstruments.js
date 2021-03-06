export function parseTAInstruments(text) {
  let lines = text
    .split(/\r?\n/)
    .filter((line) => !line.match(/(^\s*$)|(^StartOfData$)/));

  let meta = parseMeta(lines);

  let parsed = lines
    .slice(meta.dataStart, lines.length)
    .filter((line) => !line.startsWith('-'))
    .map((line) => line.split(/\s+/).map(Number));
  meta.balancePurgeFlow = [];
  meta.samplePurgeFlow = [];
  // We now assume that we always have 5 columns in the same order ...
  let result = {
    meta: meta,
    data: {
      time: [],
      weight: [],
      temperature: [],
    },
  };
  result.data.time = parsed.map((fields) => fields[0]);
  result.data.temperature = parsed.map((fields) => fields[1]);
  result.data.weight = parsed.map((fields) => fields[2]);
  result.meta.balancePurgeFlow = parsed.map((fields) => fields[3]);
  result.meta.samplePurgeFlow = parsed.map((fields) => fields[4]);

  return result;
}

function splitTrim(string, item = 1) {
  return string.split(/\t/)[item].replace(/^[ \t]*(.*?)[ \t]*$/, '$1');
}

function parseMeta(lines) {
  let meta = { comments: [], methodSteps: [] };
  for (let [i, line] of lines.entries()) {
    if (line.match(/^Instrument/)) {
      meta.instrument = splitTrim(line);
    } else if (line.match(/^InstSerial/)) {
      meta.instrumentSerial = splitTrim(line);
    } else if (line.match(/^Sample/)) {
      meta.sampleName = splitTrim(line);
    } else if (line.match(/^Size/)) {
      meta.weight = parseFloat(splitTrim(line));
      meta.weightUnit = splitTrim(line, 2);
    } else if (line.match(/^Xcomment|^Comment/)) {
      meta.comments.push(splitTrim(line));
    } else if (line.match(/^Method/)) {
      meta.method = splitTrim(line);
    } else if (line.match(/^Mode/)) {
      meta.mode = splitTrim(line);
    } else if (line.match(/^File/)) {
      meta.file = splitTrim(line);
    } else if (line.match(/^Date/)) {
      meta.date = splitTrim(line);
    } else if (line.match(/^Time/)) {
      meta.time = splitTrim(line);
    } else if (line.match(/^OrgMethod/)) {
      meta.methodSteps.push(splitTrim(line));
    } else if (line.match(/^Controls/)) {
      meta.controls = splitTrim(line);
    } else if (line.match(/^FurnaceType/)) {
      meta.furnaceType = splitTrim(line);
    } else if (line.match(/^Operator/)) {
      meta.operator = splitTrim(line);
    } else if (line.match(/^RunSerial/)) {
      meta.runSerial = splitTrim(line);
    } else if (line.match(/^ProcName/)) {
      meta.procName = splitTrim(line);
    } else if (line.match(/^OrgFile/)) {
      meta.dataStart = i + 1;
      break;
    }
  }

  return meta;
}
