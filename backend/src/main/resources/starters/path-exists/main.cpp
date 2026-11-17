#include <bits/stdc++.h>
using namespace std;

// Return true if s and t are connected through two-way roads. Places are numbered 1..n.
bool solve(int n, const vector<pair<int, int>>& roads, int s, int t) {
    // TODO: write your algorithm here
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n, m;
    cin >> n >> m;
    vector<pair<int, int>> roads(m);
    for (auto& r : roads) cin >> r.first >> r.second;
    int s, t;
    cin >> s >> t;
    cout << (solve(n, roads, s, t) ? "true" : "false") << '\n';
    return 0;
}
