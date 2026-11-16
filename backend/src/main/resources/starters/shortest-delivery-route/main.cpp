#include <bits/stdc++.h>
using namespace std;

// Return the shortest total time from node 1 to node n, or -1 if n is unreachable.
// Each edge is {u, v, w}: a one-way road from u to v taking w minutes. Nodes are numbered 1..n.
long long solve(int n, const vector<array<int, 3>>& edges) {
    // TODO: write your algorithm here
    return -1;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<array<int, 3>> edges(m);
    for (auto& e : edges) cin >> e[0] >> e[1] >> e[2];
    cout << solve(n, edges) << '\n';
    return 0;
}
