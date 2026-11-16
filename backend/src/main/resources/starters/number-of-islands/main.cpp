#include <bits/stdc++.h>
using namespace std;

// Return the number of 4-directionally connected groups of '1' cells.
int solve(vector<string>& grid) {
    // TODO: write your algorithm here
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int rows, cols;
    cin >> rows >> cols;
    vector<string> grid(rows);
    for (auto& row : grid) cin >> row;
    cout << solve(grid) << '\n';
    return 0;
}
