import { Box, Chip, Link, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { EvidenceItem } from "@airport/shared";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isRows = (v: unknown): v is Obj[] => Array.isArray(v) && v.length > 0 && v.every(isObj);
const fmt = (v: unknown) => (isObj(v) || Array.isArray(v) ? JSON.stringify(v) : String(v ?? ""));

/** Array of objects -> table; object -> key/value table (nested arrays of objects get their own table). */
function DataTable({ data }: { data: unknown }) {
  if (isRows(data)) {
    const cols = [...new Set(data.flatMap((r) => Object.keys(r)))];
    return (
      <Table size="small">
        <TableHead>
          <TableRow>{cols.map((c) => <TableCell key={c} sx={{ fontWeight: 600 }}>{c}</TableCell>)}</TableRow>
        </TableHead>
        <TableBody>
          {data.map((r, i) => (
            <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{fmt(r[c])}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  if (isObj(data)) {
    const entries = Object.entries(data);
    const scalars = entries.filter(([, v]) => !isRows(v));
    const tables = entries.filter(([, v]) => isRows(v));
    return (
      <>
        {scalars.length > 0 && (
          <Table size="small">
            <TableBody>
              {scalars.map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ fontWeight: 600 }}>{k}</TableCell>
                  <TableCell>{fmt(v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {tables.map(([k, v]) => (
          <Box key={k} sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">{k}</Typography>
            <DataTable data={v} />
          </Box>
        ))}
      </>
    );
  }
  return <Typography variant="body2">{fmt(data)}</Typography>;
}

export default function EvidencePanel({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>Evidence</Typography>
      {evidence.length === 0 && (
        <Typography variant="body2" color="text.secondary">Tool results behind the latest answer will appear here.</Typography>
      )}
      <Stack spacing={2}>
        {evidence.map((ev, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontFamily: "monospace" }}>{ev.tool}</Typography>
            <DataTable data={ev.data} />
            {ev.sources.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Sources</Typography>
                {ev.sources.map((s, j) => (
                  <Typography key={j} variant="body2">
                    <Link href={s.url} target="_blank" rel="noreferrer">{s.name}</Link>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {" "}· retrieved {new Date(s.retrievedAt).toLocaleString()}
                    </Typography>
                  </Typography>
                ))}
              </Box>
            )}
            {ev.assumptions.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Assumptions</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {ev.assumptions.map((a, j) => (
                    <Chip key={j} size="small" variant="outlined" label={a} sx={{ height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 } }} />
                  ))}
                </Stack>
              </Box>
            )}
            {ev.flags.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">Flags</Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.5}>
                  {ev.flags.map((f, j) => <Chip key={j} size="small" color="warning" label={f} />)}
                </Stack>
              </Box>
            )}
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
