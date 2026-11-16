#include <bits/stdc++.h>
using namespace std;

// Return true if t is a rearrangement of s.
bool solve(const string& s, const string& t) {
    // TODO: write your algorithm here
    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    string s, t;
    getline(cin, s);
    getline(cin, t);
    if (!s.empty() && s.back() == '\r') s.pop_back();
    if (!t.empty() && t.back() == '\r') t.pop_back();
    cout << (solve(s, t) ? "true" : "false") << '\n';
    return 0;
}
