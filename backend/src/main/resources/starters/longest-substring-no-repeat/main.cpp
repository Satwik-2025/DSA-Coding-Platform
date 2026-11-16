#include <bits/stdc++.h>
using namespace std;

// Return the length of the longest substring with all-distinct characters.
int solve(const string& s) {
    // TODO: write your algorithm here
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string s;
    getline(cin, s);
    if (!s.empty() && s.back() == '\r') s.pop_back();
    cout << solve(s) << '\n';
    return 0;
}
